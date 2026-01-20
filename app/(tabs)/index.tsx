import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'

import { DoseEvent } from '../../src/models/doseEvent'
import { Medication } from '../../src/models/medication'
import { generateTodayEvents } from '../../src/scheduling/generate'
import { DB } from '../../src/storage/db'

function iso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(yyyyMmDd: string, delta: number) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return iso(dt)
}

function hhmm(d: Date) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function toDisplayTime(hhmmStr: string) {
  const [hRaw, mRaw] = hhmmStr.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = ((h + 11) % 12) + 1
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

export default function TodayScreen() {
  const [meds, setMeds] = useState<Medication[]>([])
  const [events, setEvents] = useState<DoseEvent[]>([])
  const today = iso(new Date())

  const load = useCallback(async () => {
    try {
      const loadedMeds = await DB.getMeds()
      const loadedEventsRaw = await DB.getEvents()

      const upgraded: DoseEvent[] = loadedEventsRaw.map((e: any) => {
        if (e.localDate && e.localTime) return e as DoseEvent
        const d = new Date(e.scheduledAt)
        return { ...e, localDate: iso(d), localTime: hhmm(d) } as DoseEvent
      })

      const needUpgradeSave = loadedEventsRaw.some((e: any) => !(e.localDate && e.localTime))
      if (needUpgradeSave) await DB.saveEvents(upgraded)

      const medIds = new Set(loadedMeds.map(m => m.id))
      const noOrphans = upgraded.filter(e => medIds.has(e.medicationId))

      const byKey = new Map<string, DoseEvent>()
      for (const e of noOrphans) {
        const key = `${e.medicationId}|${e.localDate}|${e.localTime}`
        const prev = byKey.get(key)
        if (!prev) {
          byKey.set(key, e)
          continue
        }
        const prevScore = prev.actedAt ? 1 : 0
        const nextScore = e.actedAt ? 1 : 0
        if (nextScore > prevScore) byKey.set(key, e)
      }
      const deduped = Array.from(byKey.values())

      const yesterday = addDays(today, -1)
      const pruned = deduped.filter(e => e.localDate === today || e.localDate === yesterday)

      const cleanedChanged = pruned.length !== upgraded.length
      if (cleanedChanged) await DB.saveEvents(pruned)

      const created = generateTodayEvents(loadedMeds, pruned)
      const merged = [...pruned, ...created]
      if (created.length > 0) await DB.saveEvents(merged)

      setMeds(loadedMeds)
      setEvents(merged)
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Failed to load local data.')
    }
  }, [today])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const medById = useMemo(() => {
    const m = new Map<string, Medication>()
    for (const med of meds) m.set(med.id, med)
    return m
  }, [meds])

  const todaysEvents = useMemo(() => {
    return events
      .filter(e => e.localDate === today)
      .sort((a, b) => a.localTime.localeCompare(b.localTime))
  }, [events, today])

  const lowStockMeds = useMemo(() => {
    return meds
      .filter(m => m.active)
      .filter(m => Number.isFinite(m.pillsRemaining) && Number.isFinite(m.refillThreshold))
      .filter(m => m.pillsRemaining <= m.refillThreshold)
      .sort((a, b) => a.pillsRemaining - b.pillsRemaining)
  }, [meds])

  const setEventStatus = async (id: string, status: 'TAKEN' | 'SKIPPED') => {
    const current = events.find(e => e.id === id)
    if (!current || current.status !== 'PENDING') return

    const now = new Date().toISOString()
    const nextEvents = events.map(e => (e.id === id ? { ...e, status, actedAt: now } : e))
    setEvents(nextEvents)
    await DB.saveEvents(nextEvents)

    if (status === 'TAKEN') {
      const ev = nextEvents.find(e => e.id === id)
      if (!ev) return
      const nextMeds = meds.map(m => {
        if (m.id !== ev.medicationId) return m
        const next = Math.max(0, m.pillsRemaining - m.pillsPerDose)
        return { ...m, pillsRemaining: next, updatedAt: Date.now() }
      })
      setMeds(nextMeds)
      await DB.saveMeds(nextMeds)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {lowStockMeds.length > 0 && (
        <ThemedView style={styles.banner}>
          <ThemedText type="defaultSemiBold">Refill needed</ThemedText>
          <ThemedText style={{ marginTop: 4 }}>
            {lowStockMeds
              .slice(0, 3)
              .map(m => `${m.name}: ${m.pillsRemaining} pills left`)
              .join(' • ')}
            {lowStockMeds.length > 3 ? ` • +${lowStockMeds.length - 3} more` : ''}
          </ThemedText>
        </ThemedView>
      )}

      {todaysEvents.length === 0 ? (
        <ThemedText style={styles.noDoses}>No doses scheduled for today.</ThemedText>
      ) : (
        <View style={{ gap: 10 }}>
          {todaysEvents.map(e => {
            const med = medById.get(e.medicationId)
            if (!med) return null

            return (
              <ThemedView key={e.id} style={styles.card}>
                <ThemedText type="defaultSemiBold">
                  {toDisplayTime(e.localTime)} — {`${med.name} (${med.dosageText})`}
                </ThemedText>

                <ThemedText>
                  Status: {e.status} • Pills left: {med.pillsRemaining}
                  {med.pillsRemaining <= med.refillThreshold ? ' • Refill soon' : ''}
                </ThemedText>

                {e.status === 'PENDING' && (
                  <View style={styles.row}>
                    <Pressable onPress={() => setEventStatus(e.id, 'TAKEN')} style={styles.btn}>
                      <ThemedText type="defaultSemiBold">Taken</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => setEventStatus(e.id, 'SKIPPED')} style={styles.btn}>
                      <ThemedText type="defaultSemiBold">Skip</ThemedText>
                    </Pressable>
                  </View>
                )}
              </ThemedView>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  banner: { padding: 12, borderRadius: 12, gap: 4, borderWidth: 1, borderColor: '#888888' },
  card: { padding: 16, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: '#cccccc', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#999999' },
  noDoses: { textAlign: 'center', marginTop: 40, fontSize: 16, color: '#666666' },
})
