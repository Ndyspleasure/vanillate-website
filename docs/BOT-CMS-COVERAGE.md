# Cakupan kontrak CMS bot

Audit statis dari `Vanillate.ID/src/cms/handlers/*.js`. Pencocokan literal bukan bukti pengujian end-to-end; command dinamis perlu ditinjau manual.

91 handler ditemukan; 90 nama ditemukan dalam source frontend.

| Perintah | Modul bot | Literal frontend |
|---|---|---|
| `autoheal.incident` | `autoheal.js` | Ada |
| `sys.autoheal.decide` | `autoheal.js` | Ada |
| `sys.autoheal.stop` | `autoheal.js` | Ada |
| `sys.autoheal.closeBreaker` | `autoheal.js` | Ada |
| `sys.autoheal.unlock` | `autoheal.js` | Ada |
| `sys.autoheal.selftest` | `autoheal.js` | Ada |
| `sys.autoheal.simheal` | `autoheal.js` | Ada |
| `broadcast.send` | `broadcast.js` | Ada |
| `poll.voters` | `broadcast.js` | Ada |
| `poll.cancel` | `broadcast.js` | Ada |
| `campaign.forceSend` | `campaign.js` | Ada |
| `error.detail` | `errors.js` | Ada |
| `error.setStatus` | `errors.js` | Ada |
| `error.setStatusByCode` | `errors.js` | Ada |
| `error.fingerprintFixed` | `errors.js` | Ada |
| `event.setChances` | `events.js` | Ada |
| `event.resetStats` | `events.js` | Ada |
| `event.setInvader` | `events.js` | Ada |
| `game.end` | `game.js` | Ada |
| `game.forceTurn` | `game.js` | Ada |
| `game.setWord` | `game.js` | Ada |
| `game.eliminate` | `game.js` | Ada |
| `game.revive` | `game.js` | Ada |
| `game.spawnEvent` | `game.js` | Ada |
| `game.broadcast` | `game.js` | Ada |
| `panel.refresh` | `panel.js` | Ada |
| `partner.order.report` | `partner.js` | Khusus sistem portal; handler menolak aktor admin |
| `player.view` | `player.js` | Ada |
| `player.list` | `player.js` | Ada |
| `player.banned` | `player.js` | Ada |
| `player.setCoin` | `player.js` | Ada |
| `player.setScore` | `player.js` | Ada |
| `player.setWins` | `player.js` | Ada |
| `player.setLives` | `player.js` | Ada |
| `player.reset` | `player.js` | Ada |
| `player.ban` | `player.js` | Ada |
| `player.unban` | `player.js` | Ada |
| `progression.giveCoin` | `player.js` | Ada |
| `progression.giveExp` | `player.js` | Ada |
| `progression.setAccountLevel` | `player.js` | Ada |
| `progression.setClassLevel` | `player.js` | Ada |
| `progression.reset` | `player.js` | Ada |
| `boost.give` | `player.js` | Ada |
| `boost.set` | `player.js` | Ada |
| `boost.reset` | `player.js` | Ada |
| `quest.resetDaily` | `player.js` | Ada |
| `quest.resetWeekly` | `player.js` | Ada |
| `db.resetCooldown` | `player.js` | Ada |
| `promo.create` | `promo.js` | Ada |
| `promo.edit` | `promo.js` | Ada |
| `promo.disable` | `promo.js` | Ada |
| `promo.enable` | `promo.js` | Ada |
| `promo.analytics` | `promo.js` | Ada |
| `share.detail` | `share.js` | Ada |
| `share.lift` | `share.js` | Ada |
| `share.hold` | `share.js` | Ada |
| `share.report` | `share.js` | Ada |
| `sys.share.rules` | `share.js` | Ada |
| `social.detail` | `social.js` | Ada |
| `social.search` | `social.js` | Ada |
| `social.setChannel` | `social.js` | Ada |
| `social.disable` | `social.js` | Ada |
| `social.kata.remove` | `social.js` | Ada |
| `social.kata` | `social.js` | Ada |
| `sys.story.rules` | `story.js` | Ada |
| `story.detail` | `story.js` | Ada |
| `story.reset` | `story.js` | Ada |
| `story.exportIds` | `story.js` | Ada |
| `log.tail` | `system.js` | Ada |
| `sys.console.catalog` | `system.js` | Ada |
| `sys.console.run` | `system.js` | Ada |
| `sys.logs.cleanup` | `system.js` | Ada |
| `sys.db.backup` | `system.js` | Ada |
| `sys.commands.preview` | `system.js` | Ada |
| `sys.commands.deploy` | `system.js` | Ada |
| `sys.bot.updateCheck` | `system.js` | Ada |
| `sys.bot.restart` | `system.js` | Ada |
| `sys.bot.update` | `system.js` | Ada |
| `tahu.detail` | `tahu.js` | Ada |
| `tahu.reset` | `tahu.js` | Ada |
| `tahu.exportIds` | `tahu.js` | Ada |
| `tutorial.resetOne` | `tutorial.js` | Ada |
| `tutorial.doneOne` | `tutorial.js` | Ada |
| `tutorial.cleanOne` | `tutorial.js` | Ada |
| `sys.tutorial.resetAll` | `tutorial.js` | Ada |
| `word.accept` | `word.js` | Ada |
| `word.reject` | `word.js` | Ada |
| `word.search` | `word.js` | Ada |
| `word.rereview` | `word.js` | Ada |
| `word.export` | `word.js` | Ada |
| `word.bulk` | `word.js` | Ada |

## Fitur baru

`/admin/diagnostik` membaca 14 metadata snapshot (maksimal 28 baris untuk dua alias slug) dan 20 ringkasan perintah pending/processing. Dua query saat buka/perbarui; tanpa timer, payload/result besar, query hitung, atau penulisan. Menu Log & Statistik → Diagnostik Bot. Waktu lama bukan bukti offline; gunakan tautan ke panel modul untuk inspeksi dan konfigurasi yang sudah divalidasi bot.

## Handoff Claude Code Fable

Fitur diagnostik tidak membutuhkan migrasi. Memakai RLS dan indeks yang sudah ada pada bot_panel_snapshots dan bot_commands. Migrasi upgrade terdahulu tetap ada di `supabase/migrations/20261116144645_admin_auth_hardening.sql`; penerapan diserahkan kepada Fable sesuai instruksi pengguna. Jangan menambah generic SQL executor atau shell command ke CMS.

Belum semua data internal bot layak diakses dari browser: token, secret, isi pesan privat dan konfigurasi host harus tetap server-side. Handler yang belum ditemukan literalnya adalah kandidat penambahan form khusus dengan validasi, izin dan audit existing; bukan alasan membuka payload arbitrer.

Repo bot yang diaudit: commit `ca1b63a`. `partner.order.report` mengecek `ctx.actor.role === system`; tidak dibuatkan tombol yang akan gagal atau melewati otorisasi.
