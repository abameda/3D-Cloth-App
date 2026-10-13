import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bodyProfileSchema, studioStages, type BodyProfile, type StudioJob } from '../domain/studio';
import { getStudioKit, sendBodyProfile, syncPersonalKit } from '../studio';
import { Button, Chip, Field, Label, Notice, Screen, Section, ui } from '../ui/primitives';

const DRAFT = 'thread.studio.profile-draft.v1';
type Draft = Record<'age' | 'height_cm' | 'weight_kg' | 'chest_cm' | 'waist_cm' | 'hips_cm', string> & { sex?: BodyProfile['sex'] };
const empty: Draft = { age: '', height_cm: '', weight_kg: '', chest_cm: '', waist_cm: '', hips_cm: '' };
const fields: { key: keyof Omit<Draft, 'sex'>; label: string; hint: string; optional?: boolean }[] = [
  { key: 'height_cm', label: 'Height (cm)', hint: 'Barefoot, standing straight' },
  { key: 'age', label: 'Age', hint: 'Shapes posture and proportions' },
  { key: 'weight_kg', label: 'Weight (kg)', hint: 'Optional', optional: true },
  { key: 'chest_cm', label: 'Chest (cm)', hint: 'Fullest part, tape level under the arms', optional: true },
  { key: 'waist_cm', label: 'Waist (cm)', hint: 'Narrowest part, above the belly button', optional: true },
  { key: 'hips_cm', label: 'Hips (cm)', hint: 'Fullest part of the seat', optional: true },
];

/** Measurements → the computer fits a personal body that every owned garment is draped on. */
export function BodyScreen() {
  const [draft, setDraft] = useState<Draft>(empty), [busy, setBusy] = useState(false);
  const [job, setJob] = useState<StudioJob>(), [message, setMessage] = useState(''), [error, setError] = useState(false);
  const polling = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(DRAFT).then(raw => { if (active && raw) setDraft({ ...empty, ...JSON.parse(raw) as Draft }); }).catch(() => {});
    void getStudioKit().then(kit => { if (active) setJob(kit.jobs.find(j => j.kind === 'body')); }).catch(() => {});
    return () => { active = false; if (polling.current) clearInterval(polling.current); };
  }, []);

  function poll() {
    if (polling.current) clearInterval(polling.current);
    polling.current = setInterval(() => void getStudioKit().then(async kit => {
      const latest = kit.jobs.find(j => j.kind === 'body'); setJob(latest);
      if (latest && latest.status !== 'queued' && latest.status !== 'running') {
        clearInterval(polling.current);
        if (latest.status === 'done') { await syncPersonalKit(); setMessage('Your body is ready. Your dressing room now uses it, and fitted clothes are being redraped on it.'); }
        else { setError(true); setMessage(latest.error ?? 'Your computer could not fit the body.'); }
      }
    }).catch(() => {}), 3000);
  }

  async function submit() {
    setMessage(''); setError(false);
    const number = (value: string) => value.trim() ? Number(value.replace(',', '.')) : undefined;
    const parsed = bodyProfileSchema.safeParse({
      sex: draft.sex, age: number(draft.age), height_cm: number(draft.height_cm), weight_kg: number(draft.weight_kg),
      chest_cm: number(draft.chest_cm), waist_cm: number(draft.waist_cm), hips_cm: number(draft.hips_cm),
    });
    if (!parsed.success) { setError(true); setMessage('Choose a body type and enter a height (130–220 cm) and age (16–90). Tape measurements must be in centimetres.'); return; }
    setBusy(true);
    try {
      await AsyncStorage.setItem(DRAFT, JSON.stringify(draft));
      await sendBodyProfile(parsed.data);
      setMessage('Sent to your computer. Fitting takes a minute or two; clothes are redraped afterwards.'); poll();
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'Couldn’t reach your computer.'); }
    finally { setBusy(false); }
  }

  const working = job?.status === 'queued' || job?.status === 'running';
  return <Screen>
    <Label muted>Your measurements shape a personal 3D body on your computer. Every piece you fit is draped on exactly this body, so the dressing room shows how your clothes sit on you. Measurements stay on your phone and computer.</Label>
    <Section title="Body type">
      <View style={ui.wrap}>
        <Chip title="Male" selected={draft.sex === 'male'} onPress={() => setDraft(d => ({ ...d, sex: 'male' }))} />
        <Chip title="Female" selected={draft.sex === 'female'} onPress={() => setDraft(d => ({ ...d, sex: 'female' }))} />
      </View>
    </Section>
    <Section title="Measurements">
      {fields.map(field => <View key={field.key} style={{ gap: 4 }}>
        <Field label={field.label} keyboardType="decimal-pad" inputMode="decimal" value={draft[field.key]} placeholder={field.optional ? 'Optional' : undefined}
          onChangeText={value => setDraft(d => ({ ...d, [field.key]: value }))} />
        <Label muted size={13}>{field.hint}</Label>
      </View>)}
    </Section>
    {job && <Notice error={job.status === 'failed'}>{working ? `${studioStages[job.stage as keyof typeof studioStages] ?? job.stage}…` : job.status === 'done' ? 'Last fit finished.' : job.error ?? 'The last fit stopped.'}</Notice>}
    {!!message && <Notice error={error}>{message}</Notice>}
    <Button title={working ? 'Fitting on your computer…' : 'Create my body'} icon="person" loading={busy} disabled={working} onPress={() => void submit()} />
  </Screen>;
}
