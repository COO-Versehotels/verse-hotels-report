-- TOMBOL DARURAT Verse Apps (17 Okt 2026)
-- Jalankan di Supabase > SQL Editor (project hgbqecsmhrzlavsjwlwq) HANYA bila Verse Apps bermasalah setelah penguncian.
-- Efek: tabel laporan dll kembali terbuka seperti sebelum dikunci. Aplikasi versi baru tetap jalan normal.
alter policy "allow all" on public.laporan using (true) with check (true);
alter policy "allow all laporan" on public.laporan using (true) with check (true);
alter policy "allow all laporan_detail" on public.laporan_detail using (true) with check (true);
alter policy "allow all" on public.arsip using (true) with check (true);
alter policy "allow all arsip" on public.arsip using (true) with check (true);
alter policy "allow all" on public.draft_tasklist using (true) with check (true);
alter policy "allow all draft" on public.draft_tasklist using (true) with check (true);
alter policy "allow all laporan_cek" on public.laporan_cek using (true) with check (true);
alter policy allow_all on public.team_location using (true) with check (true);
alter policy "user_login_log all access" on public.user_login_log using (true) with check (true);
alter policy "Allow select for all" on public.location_log using (true);
alter policy "Allow insert for all" on public.location_log with check (true);
alter policy anon_select_room_checks on public.room_checks using (true);
alter policy anon_insert_room_checks on public.room_checks with check (true);
alter policy anon_update_room_checks on public.room_checks using (true) with check (true);
alter policy anon_delete_room_checks on public.room_checks using (true);
alter policy "izin baca link laporan" on public.wa_report_links using (true);
alter policy "izin buat link laporan" on public.wa_report_links with check (true);
alter policy defects_all_anon on public.defects using (true) with check (true);
