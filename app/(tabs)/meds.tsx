import DateTimePicker from '@react-native-community/datetimepicker'
import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'

import { useFocusEffect } from '@react-navigation/native'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'

import { Medication } from '../../src/models/medication'
import { ensureNotificationPermission, rescheduleFromDb } from '../../src/scheduling/notifications'
import { DB } from '../../src/storage/db'

function iso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function uuid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function hhmm(d: Date) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function fromPicker(d: Date) {
  const h = d.getHours()
  const m = d.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function toDisplayTime(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = ((h + 11) % 12) + 1
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

function normalizeTimes(times: string[]) {
  return Array.from(new Set(times)).sort((a, b) => a.localeCompare(b))
}

function digitsOnly(s: string) {
  return s.replace(/[^\d]/g, '')
}

export default function MedicationsScreen() {
  const [meds, setMeds] = useState<Medication[]>([])

  const [name, setName] = useState('')
  const [dosageText, setDosageText] = useState('')
  const [times, setTimes] = useState<string[]>([])

  const [pillsRemaining, setPillsRemaining] = useState('')
  const [pillsPerDose, setPillsPerDose] = useState('')
  const [refillThreshold, setRefillThreshold] = useState('')

  const [showPicker, setShowPicker] = useState(false)
  const [pickerDate, setPickerDate] = useState(new Date())

  const load = useCallback(async () => {
    try {
      const loaded = await DB.getMeds()
      setMeds(loaded)
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Failed to load medications.')
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const addTime = (t: string) => setTimes(prev => normalizeTimes([...prev, t]))
  const removeTime = (t: string) => setTimes(prev => prev.filter(x => x !== t))

  const canAdd = useMemo(() => {
    return (
      name.trim().length > 0 &&
      dosageText.trim().length > 0 &&
      times.length > 0 &&
      pillsRemaining.length > 0 &&
      pillsPerDose.length > 0 &&
      refillThreshold.length > 0
    )
  }, [name, dosageText, times, pillsRemaining, pillsPerDose, refillThreshold])

  const addMedication = async () => {
    const trimmedName = name.trim()
    const trimmedDose = dosageText.trim()

    if (!trimmedName) return Alert.alert('Missing name', 'Enter a medication name.')
    if (!trimmedDose) return Alert.alert('Missing dosage', 'Enter a dosage (e.g., 50 mg).')
    if (times.length === 0) return Alert.alert('Missing times', 'Add at least one time.')

    const pr = Number(pillsRemaining)
    const pp = Number(pillsPerDose)
    const rt = Number(refillThreshold)

    if (!Number.isFinite(pr) || pr < 0) return Alert.alert('Invalid pills remaining', 'Enter a non-negative number.')
    if (!Number.isFinite(pp) || pp <= 0) return Alert.alert('Invalid pills per dose', 'Enter a positive number.')
    if (!Number.isFinite(rt) || rt < 0) return Alert.alert('Invalid threshold', 'Enter a non-negative number.')

    const med: Medication = {
      id: uuid(),
      name: trimmedName,
      dosageText: trimmedDose,
      instructions: '',
      times,
      startDate: iso(new Date()),
      active: true,
      pillsRemaining: pr,
      pillsPerDose: pp,
      refillThreshold: rt,
      updatedAt: Date.now(),
    }

    const next = [med, ...meds]
    setMeds(next)
    await DB.saveMeds(next)

    const ok = await ensureNotificationPermission()
    if (ok) await rescheduleFromDb()

    setName('')
    setDosageText('')
    setTimes([])
    setPillsRemaining('')
    setPillsPerDose('')
    setRefillThreshold('')
    Keyboard.dismiss()
  }

  const toggleActive = async (id: string) => {
    const next = meds.map(m => (m.id === id ? { ...m, active: !m.active, updatedAt: Date.now() } : m))
    setMeds(next)
    await DB.saveMeds(next)

    const ok = await ensureNotificationPermission()
    if (ok) await rescheduleFromDb()
  }

  const removeMedication = async (id: string) => {
    Alert.alert('Delete medication?', 'This removes it from your list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const next = meds.filter(m => m.id !== id)
          setMeds(next)
          await DB.saveMeds(next)

          const ok = await ensureNotificationPermission()
          if (ok) await rescheduleFromDb()
        },
      },
    ])
  }

  const onPickerChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (!selected) return
    setPickerDate(selected)
  }

  const openPicker = () => {
    Keyboard.dismiss()
    const d = new Date()
    const current = times.length > 0 ? times[times.length - 1] : null
    if (current) {
      const [h, m] = current.split(':').map(Number)
      d.setHours(h, m, 0, 0)
    }
    setPickerDate(d)
    setShowPicker(true)
  }

  const confirmPicker = () => {
    addTime(fromPicker(pickerDate))
    setShowPicker(false)
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <ThemedText type="title">Medications</ThemedText>
      </View>

      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold">Add medication</ThemedText>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor="#888"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          autoCorrect={false}
        />

        <TextInput
          value={dosageText}
          onChangeText={setDosageText}
          placeholder="Dose (e.g., 50 mg)"
          placeholderTextColor="#888"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          autoCorrect={false}
        />

        <ThemedText type="defaultSemiBold">Times</ThemedText>

        <View style={styles.timesWrap}>
          {times.map(t => (
            <Pressable key={t} onPress={() => removeTime(t)} style={styles.timeChip}>
              <ThemedText type="defaultSemiBold">{toDisplayTime(t)} ×</ThemedText>
            </Pressable>
          ))}
          <Pressable onPress={openPicker} style={styles.addTimeBtn}>
            <ThemedText type="defaultSemiBold">+ Add time</ThemedText>
          </Pressable>
        </View>

        {showPicker && (
          <ThemedView style={styles.pickerBox}>
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
            />
            <View style={styles.row}>
              <Pressable onPress={() => setShowPicker(false)} style={styles.smallBtn}>
                <ThemedText type="defaultSemiBold">Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={confirmPicker} style={styles.primaryBtnSmall}>
                <ThemedText type="defaultSemiBold">Add</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        )}

        <View style={styles.row}>
          <TextInput
            value={pillsRemaining}
            onChangeText={t => setPillsRemaining(digitsOnly(t))}
            placeholder="Pills left"
            placeholderTextColor="#888"
            style={[styles.input, styles.half]}
            keyboardType="number-pad"
            inputMode="numeric"
          />
          <TextInput
            value={pillsPerDose}
            onChangeText={t => setPillsPerDose(digitsOnly(t))}
            placeholder="Pills per dose"
            placeholderTextColor="#888"
            style={[styles.input, styles.half]}
            keyboardType="number-pad"
            inputMode="numeric"
          />
        </View>

        <TextInput
          value={refillThreshold}
          onChangeText={t => setRefillThreshold(digitsOnly(t))}
          placeholder="Refill alert at (pills)"
          placeholderTextColor="#888"
          style={styles.input}
          keyboardType="number-pad"
          inputMode="numeric"
        />

        <Pressable onPress={addMedication} style={[styles.primaryBtn, !canAdd && styles.disabled]} disabled={!canAdd}>
          <ThemedText type="defaultSemiBold">Add</ThemedText>
        </Pressable>
      </ThemedView>





      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Your list</ThemedText>
        <ThemedText>{meds.length} {meds.length === 1 ? 'med' : 'meds'}</ThemedText>
      </ThemedView>

      {meds.length === 0 ? (
        <ThemedText>No medications added yet.</ThemedText>
      ) : (
        <View style={{ gap: 10 }}>
          {meds.map(m => (
            <ThemedView key={m.id} style={styles.card}>
              <ThemedText type="defaultSemiBold">
                {m.name} ({m.dosageText})
              </ThemedText>

              <ThemedText>
                {m.active ? 'Active' : 'Inactive'} • Times:{' '}
                {m.times.map(t => toDisplayTime(t)).join(', ')}
              </ThemedText>
              <ThemedText>
                Pills left: {m.pillsRemaining} • Alert at: {m.refillThreshold} {m.pillsRemaining <= m.refillThreshold ? ' • Refill soon' : ''}
              </ThemedText>

              <View style={styles.row}>
                <Pressable onPress={() => toggleActive(m.id)} style={styles.smallBtn}>
                  <ThemedText type="defaultSemiBold">{m.active ? 'Disable' : 'Enable'}</ThemedText>
                </Pressable>
                <Pressable onPress={() => removeMedication(m.id)} style={styles.dangerBtn}>
                  <ThemedText type="defaultSemiBold">Delete</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },

  card: { padding: 12, borderRadius: 12, gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  input: { borderWidth: 1, borderColor: '#999', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, color: '#fff' },
  half: { flex: 1 },

  timesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  timeChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#999' },
  addTimeBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#999' },

  pickerBox: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#999', gap: 10 },

  primaryBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#999', alignItems: 'center' },
  primaryBtnSmall: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#999' },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#999' },
  dangerBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#b55' },
  disabled: { opacity: 0.5 },

  accessory: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#111' },
  accessoryBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#999' },
})
