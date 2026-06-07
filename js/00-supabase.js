// Configuracion publica de Supabase.
// La key anon puede vivir en frontend; las reglas RLS de Supabase son las que protegen los datos.
const SUPABASE_URL = "https://otydjeobxzcpobzengsv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90eWRqZW9ieHpjcG9iemVuZ3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxODUzMzAsImV4cCI6MjA5NTc2MTMzMH0.SINhhycH6250d0zIyasgXO-4chac-80cnZ0vWKeJd5c";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
