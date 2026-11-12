-- Rollback Portal Penulis Blog. Menghapus profil penulis, tulisan, dan riwayat
-- (akun auth.users dan berkas di bucket `blog-penulis` dihapus terpisah lewat
-- dashboard Supabase / Edge Function).
drop function if exists public.blog_submission_delete(uuid);
drop function if exists public.blog_submission_revise(uuid, uuid);
drop function if exists public.blog_submission_review(uuid, text, uuid, text, text);
drop function if exists public.blog_submission_submit(uuid, uuid);
drop table if exists public.blog_review_log;
drop table if exists public.blog_submissions;
drop function if exists public.blog_submissions_guard();
drop table if exists public.blog_writers;
drop function if exists public.blog_writers_touch();
