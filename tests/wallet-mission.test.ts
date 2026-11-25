import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMission, missionState, discordMessageUrl, localToIso, isoToLocal, type MissionForm } from '../src/lib/wallet-mission.ts';

const base: MissionForm = {
  title: 'Follow Media Sosial', description: 'Ikuti akun resmi dan kirim bukti.', instructions: '1. Buka tautan.\n2. Ikuti akun.',
  targetUrl: 'https://example.com', rewardVp: '25', proofLink: false, proofText: false, proofImage: true, active: true,
};

test('checkMission: payload sama dengan yang diharapkan bot', () => {
  const r = checkMission(base);
  assert.ok(r.ok, r.error ?? '');
  assert.equal(r.payload!.rewardVp, 25);
  assert.equal(r.payload!.quota, null);
  assert.equal(r.payload!.proofImage, true);
  assert.equal('id' in r.payload!, false);
  assert.equal(checkMission({ ...base, id: '7' }).payload!.id, 7);
});

test('checkMission: batas sama dengan bot (normalizeMission)', () => {
  assert.match(checkMission({ ...base, title: 'Ab' }).error!, /Nama misi/);
  assert.match(checkMission({ ...base, rewardVp: '0' }).error!, /Reward/);
  assert.match(checkMission({ ...base, rewardVp: '1000001' }).error!, /Reward/);
  assert.match(checkMission({ ...base, proofImage: false }).error!, /jenis bukti/);
  assert.match(checkMission({ ...base, targetUrl: 'http://x.com' }).error!, /https/);
  assert.match(checkMission({ ...base, quota: '0' }).error!, /Kuota/);
  assert.match(checkMission({ ...base, startsAt: '2026-12-02T10:00', endsAt: '2026-12-01T10:00' }).error!, /berakhir/);
});

test('missionState dan tautan kartu Discord', () => {
  const m = { active: true, startsAt: null, endsAt: null, quota: 2, approvedCount: 2 };
  assert.equal(missionState(m), 'Kuota penuh');
  assert.equal(missionState({ ...m, active: false }), 'Nonaktif');
  assert.equal(missionState({ ...m, quota: null, endsAt: 1 }), 'Berakhir');
  assert.equal(missionState({ ...m, quota: null, startsAt: Date.now() + 60_000 }), 'Terjadwal');
  assert.equal(missionState({ ...m, quota: null }), 'Aktif');
  assert.equal(discordMessageUrl('111111111111111111', '1575020341376581683', '222222222222222222'), 'https://discord.com/channels/111111111111111111/1575020341376581683/222222222222222222');
  assert.equal(discordMessageUrl(null, '1575020341376581683', '222222222222222222'), null);
});

test('tanggal datetime-local bolak-balik', () => {
  const iso = localToIso('2026-12-01T10:30')!;
  assert.equal(isoToLocal(iso), '2026-12-01T10:30');
  assert.equal(localToIso(''), null);
});

test('teks tanpa tanda pisah', () => {
  for (const f of [{ ...base, title: 'Ab' }, { ...base, rewardVp: 0 }, { ...base, proofImage: false }]) {
    assert.ok(!/[—–]| - /.test(checkMission(f).error!));
  }
});
