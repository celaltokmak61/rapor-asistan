import asyncio
import sys
import os
import json
import re
from pathlib import Path

# Backend modül yolunu ekle
sys.path.insert(0, str(Path(__file__).resolve().parent))

from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown
from rich.text import Text
from rich.syntax import Syntax
from rich.prompt import Prompt, Confirm
from app.engine.trainer import training_agent
from app.engine.schema_manager import schema_manager
from app.engine.llm_client import llm_client
from app.db.connection import db_manager
from app.db.knowledge_db import knowledge_db
from app.core.config import settings

console = Console()

def print_header():
    console.clear()
    header_text = """
[bold green]╔═══════════════════════════════════════════════════════════════════════════════╗[/bold green]
[bold green]║       👑 RAPOR ASISTAN - YAPAY ZEKA GELİŞTİRME & EĞİTİM AKADEMİSİ            ║[/bold green]
[bold green]║   (Altın SQL, Kurumsal Değerler, Kâr/Fire Kuralları & Teşhis Rehberleri)      ║[/bold green]
[bold green]╚═══════════════════════════════════════════════════════════════════════════════╝[/bold green]
    """
    console.print(header_text)
    
    golden_count = len(knowledge_db.get_all_golden_sql())
    values_count = len(knowledge_db.get_active_corporate_values())
    rules_count = len(knowledge_db.get_active_business_rules())
    playbooks_count = len(knowledge_db.get_active_diagnostic_playbooks())

    info_table = Table(show_header=False, box=None)
    info_table.add_column("Key", style="bold cyan")
    info_table.add_column("Val", style="bold white")
    info_table.add_row("🚀 Aktif LLM Motoru:", llm_client.current_model)
    info_table.add_row("🗄️ Canlı MSSQL:", f"{settings.MSSQL_SERVER} ({settings.MSSQL_DATABASE})")
    info_table.add_row("⭐ Altın SQL Sorguları:", f"{golden_count} adet onaylı SQL")
    info_table.add_row("🏛️ Şirket Değerleri:", f"{values_count} adet ilke")
    info_table.add_row("⚖️ Kâr & Fire Kuralları:", f"{rules_count} adet iş kuralı")
    info_table.add_row("🔍 Teşhis Rehberleri:", f"{playbooks_count} adet playbook")
    
    console.print(Panel(info_table, title="[bold yellow]Kurumsal Hafıza Durumu (SQLite knowledge.db)[/bold yellow]", border_style="green"))
    console.print("[dim]Hızlı Komutlar: '1' Altın SQL Eğit | '2' İş Kuralı Eğit | '3' Şirket Değeri Eğit | '4' Teşhis Rehberi Eğit | '5' Kuralları Listele | 'cikis'[/dim]\n")

async def check_systems():
    llm_ok = await llm_client.is_available()
    if llm_ok:
        console.print(f"[bold green]✅ LLM Aktif![/bold green] Sağlayıcı: {llm_client.current_model}")
    else:
        console.print(f"[bold red]⚠️  LLM servisi yanıt vermiyor ({llm_client.current_model}).[/bold red]")

    db_res = db_manager.test_connection()
    if db_res.get("success"):
        console.print(f"[bold green]✅ Canlı MSSQL Bağlandı:[/bold green] {settings.MSSQL_SERVER} -> {db_res.get('database')}\n")
    else:
        console.print(f"[bold red]⚠️  MSSQL Bağlantı Hatası:[/bold red] {db_res.get('error')}\n")

def display_query_results(result_data: dict):
    data = result_data.get("data", [])
    columns = result_data.get("columns", [])
    row_count = result_data.get("row_count", 0)

    if not data:
        console.print("[yellow]Sorgu başarıyla çalıştı ancak dönen kayıt bulunamadı (0 satır).[/yellow]\n")
        return

    table = Table(title=f"📊 Canlı MSSQL Sonucu ({row_count} Kayıt)", border_style="green")
    for col in columns:
        table.add_column(str(col), style="cyan")

    for row in data[:15]:
        table.add_row(*[str(row.get(col, "")) for col in columns])

    console.print(table)
    if row_count > 15:
        console.print(f"[dim]... ve {row_count - 15} satır daha (İlk 15 satır gösterildi)[/dim]\n")

def train_golden_sql_interactive():
    console.print("\n[bold yellow]⭐ ALTIN SQL SORGUSU EĞİTİMİ[/bold yellow]")
    soru = Prompt.ask("[cyan]Kullanıcının soracağı doğal dil sorusu[/cyan]").strip()
    if not soru: return
    
    console.print("[dim]Örnek SQL: SELECT URUN_ADI, SUM(MIKTAR) AS MIKTAR FROM STOK_HAREKET GROUP BY URUN_ADI[/dim]")
    sql_q = Prompt.ask("[cyan]Çalıştırılacak Kesin ve Hatasız T-SQL[/cyan]").strip()
    if not sql_q: return

    chart_type = Prompt.ask("[cyan]Grafik Türü (table, bar, line, pie)[/cyan]", default="table")
    aciklama = Prompt.ask("[cyan]Kural Açıklaması / Notu[/cyan]", default="Eğitim konsolundan eklendi")
    
    knowledge_db.add_golden_sql(soru=soru, sql_query=sql_q, chart_type=chart_type, aciklama=aciklama)
    console.print("[bold green]✅ Altın SQL kuralı kalıcı olarak SQLite hafızasına kaydedildi![/bold green]\n")

def train_business_rule_interactive():
    console.print("\n[bold yellow]⚖️ İŞ KURALI VE KÂR/FİRE EŞİĞİ EĞİTİMİ[/bold yellow]")
    kategori = Prompt.ask("[cyan]Kategori (ADET PASTA GRUBU, BAKLAVA GRUBU, DONDURMA, STOK, GENEL)[/cyan]", default="GENEL")
    rule_name = Prompt.ask("[cyan]Kural Başlığı / Adı[/cyan]").strip()
    rule_text = Prompt.ask("[cyan]Kural Açıklaması (Örn: Minimum brüt kâr %55 olmalıdır)[/cyan]").strip()
    min_margin = Prompt.ask("[cyan]Minimum Kâr Marjı % (Yoksa boş geçin)[/cyan]", default="")
    max_loss = Prompt.ask("[cyan]Maksimum Fire / Zayiat % (Yoksa boş geçin)[/cyan]", default="")
    action = Prompt.ask("[cyan]İhlal Durumunda Önerilecek Aksiyon[/cyan]", default="Maliyet ve reçeteyi incele.")

    m_val = float(min_margin) if min_margin else None
    l_val = float(max_loss) if max_loss else None

    knowledge_db.add_business_rule(
        category=kategori,
        rule_name=rule_name,
        rule_text=rule_text,
        min_margin=m_val,
        max_loss=l_val,
        action_recommendation=action
    )
    console.print("[bold green]✅ İş Kuralı ve Kâr Eşiği hafızaya kaydedildi![/bold green]\n")

def train_corporate_value_interactive():
    console.print("\n[bold yellow]🏛️ ŞİRKET DEĞERİ VE İŞ AHLAKI EĞİTİMİ[/bold yellow]")
    title = Prompt.ask("[cyan]Prensip / Değer Başlığı[/cyan]").strip()
    desc = Prompt.ask("[cyan]Değer Açıklaması ve Uygulanış Biçimi[/cyan]").strip()
    prio = Prompt.ask("[cyan]Önem Derecesi (KRİTİK, YÜKSEK, ORTA)[/cyan]", default="YÜKSEK")

    knowledge_db.add_corporate_value(title=title, description=desc, priority=prio)
    console.print("[bold green]✅ Kurumsal Değer ve İş Ahlakı ilkesi hafızaya kaydedildi![/bold green]\n")

def train_diagnostic_playbook_interactive():
    console.print("\n[bold yellow]🔍 ANOMALİ VE KÖK NEDEN TEŞHİS REHBERİ EĞİTİMİ[/bold yellow]")
    code = Prompt.ask("[cyan]Anomali Kodu (EKSI_STOK, SAYIM_FARKI, DUSUK_KAR, YUKSEK_FIRE)[/cyan]").strip().upper()
    title = Prompt.ask("[cyan]Rehber Başlığı[/cyan]").strip()
    guide = Prompt.ask("[cyan]Kök Neden Açıklaması[/cyan]").strip()
    action = Prompt.ask("[cyan]Önerilecek Aksiyon Şablonu[/cyan]").strip()
    steps_raw = Prompt.ask("[cyan]Kontrol Adımları (Virgülle ayırarak yazın)[/cyan]").strip()
    steps = [s.strip() for s in steps_raw.split(",") if s.strip()]

    knowledge_db.add_diagnostic_playbook(
        anomaly_type=code,
        title=title,
        check_steps=steps,
        root_cause_guide=guide,
        action_template=action
    )
    console.print("[bold green]✅ Teşhis Rehberi (Playbook) hafızaya kaydedildi![/bold green]\n")

def list_all_rules():
    console.print("\n[bold yellow]📋 KURUMSAL HAFIZA LİSTESİ[/bold yellow]\n")
    
    # Şirket Değerleri
    vals = knowledge_db.get_active_corporate_values()
    v_table = Table(title="🏛️ Şirket Değerleri", border_style="cyan")
    v_table.add_column("ID", style="dim")
    v_table.add_column("Başlık", style="bold")
    v_table.add_column("Öncelik", style="yellow")
    v_table.add_column("Açıklama")
    for v in vals:
        v_table.add_row(str(v["id"]), v["title"], v["priority"], v["description"])
    console.print(v_table)
    console.print()

    # İş Kuralları
    rules = knowledge_db.get_active_business_rules()
    r_table = Table(title="⚖️ İş Kuralları & Kâr Eşikleri", border_style="green")
    r_table.add_column("ID", style="dim")
    r_table.add_column("Kategori", style="bold green")
    r_table.add_column("Kural Adı", style="bold")
    r_table.add_column("Min Kâr", style="cyan")
    r_table.add_column("Kural Metni")
    for r in rules:
        min_m = f"%{r['min_margin_pct']}" if r['min_margin_pct'] else "-"
        r_table.add_row(str(r["id"]), r["category"], r["rule_name"], min_m, r["rule_text"])
    console.print(r_table)
    console.print()

async def main_loop():
    print_header()
    await check_systems()

    while True:
        try:
            user_input = Prompt.ask("[bold green]👨‍💻 Geliştirici / Danışman (Siz)[/bold green]").strip()
            if not user_input: continue

            if user_input.lower() in ["cikis", "exit", "quit"]:
                console.print("[bold yellow]Eğitim konsolundan çıkılıyor. Kolay gelsin![/bold yellow]")
                break

            elif user_input == "1" or user_input.lower() == "altinegit":
                train_golden_sql_interactive()
                continue

            elif user_input == "2" or user_input.lower() == "kurulegit":
                train_business_rule_interactive()
                continue

            elif user_input == "3" or user_input.lower() == "degerdegit":
                train_corporate_value_interactive()
                continue

            elif user_input == "4" or user_input.lower() == "teshisegit":
                train_diagnostic_playbook_interactive()
                continue

            elif user_input == "5" or user_input.lower() == "kurallar":
                list_all_rules()
                continue

            elif user_input.lower() in ["temizle", "cls", "clear"]:
                print_header()
                continue

            # -------------------------------------------------------------
            # CANLI SORU VE İKİ KADEMELİ STRATEJİK ANALİZ TESTİ
            # -------------------------------------------------------------
            with console.status("[bold green]🧠 1. Kademe: SQL ve Canlı Veri Çıkarılıyor...[/bold green]"):
                from app.packs.loader import get_pack
                pack = get_pack()
                res = await training_agent.process_training_input(user_input, active_firm=pack.default_firm)

            parsed = res.get("response", {})
            sql_query = parsed.get("sql_query")
            explanation = parsed.get("explanation", "")
            target_db = parsed.get("target_database") or pack.default_database
            report_title = parsed.get("report_title") or explanation or "Canlı Analiz Çıktısı"

            if sql_query:
                syntax_sql = Syntax(sql_query, "sql", theme="monokai", line_numbers=True)
                console.print(Panel(syntax_sql, title=f"⚡ Üretilen SQL ({target_db}) - {res.get('model')}", border_style="cyan"))

                with console.status("[bold green]🗄️ Canlı MSSQL'de Çalıştırılıyor...[/bold green]"):
                    db_res = db_manager.execute_query(sql_query, target_db=target_db)

                if db_res.get("success"):
                    display_query_results(db_res)
                    rows = db_res.get("data", [])

                    # 2. Kademe Stratejik Analiz
                    with console.status("[bold magenta]🧠 2. Kademe: Kurumsal Değerler & Kâr Kuralları Işığında Stratejik Teşhis Üretiliyor...[/bold magenta]"):
                        strat_res = await llm_client.analyze_data_strategically(
                            user_query=user_input,
                            report_title=report_title,
                            data_rows=rows,
                            active_firm=pack.default_firm
                        )

                    insight = strat_res.get("insight", "")
                    console.print(Panel(Markdown(insight), title="[bold magenta]👔 Stratejik Analiz Teşhisi[/bold magenta]", border_style="magenta"))
                else:
                    console.print(f"[bold red]❌ SQL Hatası:[/bold red] {db_res.get('error')}\n")
            else:
                console.print(Panel(Markdown(explanation), title="🤖 Rapor-AI Yanıtı", border_style="green"))

        except (KeyboardInterrupt, EOFError):
            break
        except Exception as e:
            console.print(f"[bold red]Hata:[/bold red] {e}\n")

if __name__ == "__main__":
    asyncio.run(main_loop())
