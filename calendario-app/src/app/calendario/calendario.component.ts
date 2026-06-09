import { Component, ViewEncapsulation, AfterViewChecked, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CalendarView, CalendarEvent, CalendarEventTimesChangedEvent } from 'angular-calendar';
import { addMonths, addWeeks, subMonths, subWeeks, addDays, subDays } from 'date-fns';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';

import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

import { ApiService } from '../servicios/api.service';

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.component.html',
  styleUrls: ['./calendario.component.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarioComponent implements AfterViewChecked, OnInit {
  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate: Date = new Date();
  refresh = new Subject<void>(); 
  events: CalendarEvent[] = [];
  eventoEditando: CalendarEvent | null = null;
  
  periodoSeleccionado: string = '';

  eventoForm: any = { docente: '', materia: '', periodo: '', bloques: [] };

  listaPeriodos: string[] = [
    'PAO 2025-01 ABRIL - AGOST',
    'PAO 2026-01 ABRIL - AGOST',
    'PAO 2026-02 OCTUBRE - FEBRERO',
    'PAO 2027-01 ABRIL - AGOST',
  ];

  tablaColores: any = {
    1: "#70B2E8", 2: "#9f9797", 3: "#dc5d4c", 4: "#b9d3bd", 5: "#e8c583", 6: "#b29574", 0: "#cba8cb"  
  };

  mensajeError: string = '';
  tipoDocente: 'Contratado' | 'Por Contratar' = 'Contratado';
  materiasDisponibles: string[] = [''];

  constructor(private modalService: NgbModal, private apiService: ApiService) {}

  ngOnInit(): void {
    const vistaGuardada = localStorage.getItem('vistaCalendario');
    if (vistaGuardada) { this.view = vistaGuardada as CalendarView; }
    this.cargarHorariosDesdeAPI();
  }

  agregarBloque() {
    this.eventoForm.bloques.push({ inicio: '', fin: '' });
  }

  eliminarBloque(index: number) {
    this.eventoForm.bloques.splice(index, 1);
  }

  cargarHorariosDesdeAPI() {
    const misParametros = { id_token: 'TU_TOKEN_AQUI', gen_periodos_period_id: '1', id_carrera_md5: 'TU_CARRERA_HASH' };
    this.apiService.cargarHorarios(misParametros).subscribe({
      next: (res: any) => {
        this.events = res.map((item: any) => ({
          title: item.materia, start: new Date(item.fecha_inicio), end: new Date(item.fecha_fin), meta: { docente: item.docente }
        }));
        this.refresh.next();
      },
      error: (err) => console.error("Error al conectar:", err)
    });
  }

  ngAfterViewChecked() {
    const headers = document.querySelectorAll('.cal-header');
    headers.forEach((header: any) => { if (header.innerText.toLowerCase().trim() === 'schedule') { header.innerText = 'Hora'; } });
  }
  
  abrirModal(template: any, data: any) {
    this.eventoEditando = null;
    this.mensajeError = ''; 
    const eventoSeleccionado = data.event || data;
    
    if (eventoSeleccionado && eventoSeleccionado.start) {
      this.eventoEditando = eventoSeleccionado;
      this.tipoDocente = eventoSeleccionado.meta?.tipo || 'Contratado';
      this.llenarFormulario(eventoSeleccionado);
    } else {
      this.tipoDocente = 'Contratado';
      // Reiniciar formulario con array vacío
      this.eventoForm = { docente: '', materia: '', periodo: '', bloques: [] };
    }
    this.modalService.open(template, { centered: true });
  }

  llenarFormulario(event: CalendarEvent) {
    this.eventoForm = {
      docente: event.meta?.docente || '',
      materia: event.meta?.materia || event.title || '',
      periodo: event.meta?.periodo || '',
      // Se carga un bloque inicial basado en el evento existente
      bloques: [{ 
        inicio: ('0' + event.start.getHours()).slice(-2) + ':' + ('0' + event.start.getMinutes()).slice(-2),
        fin: event.end ? ('0' + event.end.getHours()).slice(-2) + ':' + ('0' + event.end.getMinutes()).slice(-2) : '09:00'
      }]
    };
  }

  guardarEvento(modal: any) {
    if (this.eventoForm.bloques.length === 0) {
      this.mensajeError = "Debes agregar al menos un bloque de horario.";
      return;
    }

    // Procesamos el primer bloque para el calendario
    const primerBloque = this.eventoForm.bloques[0];
    const [hI, mI] = primerBloque.inicio.split(':').map(Number);
    const [hF, mF] = primerBloque.fin.split(':').map(Number);
    const base = new Date();
    const nuevoInicio = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hI, mI);
    const nuevoFin = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hF, mF);
    
    const eventoEnConflicto = this.events.find(e => { if (e === this.eventoEditando) return false; return (nuevoInicio < e.end! && nuevoFin > e.start); });
    if (eventoEnConflicto) { this.mensajeError = `¡Error! Ya existe una clase en este horario.`; return; }
    
    const c = this.getColorMateria(this.eventoForm.materia + this.eventoForm.docente);
    const nuevoEvento: CalendarEvent = {
      title: this.eventoForm.materia,
      start: nuevoInicio,
      end: nuevoFin,
      color: { primary: c.border, secondary: c.bg },
      draggable: true,
      meta: { docente: this.eventoForm.docente, materia: this.eventoForm.materia, tipo: this.tipoDocente, periodo: this.eventoForm.periodo }
    };
    
    if (this.eventoForm.periodo) this.periodoSeleccionado = this.eventoForm.periodo;
    
    if (this.eventoEditando) { this.events = this.events.map(e => e === this.eventoEditando ? nuevoEvento : e); } else { this.events = [...this.events, nuevoEvento]; }
    this.refresh.next();
    modal.close();
  }

  eventTimesChanged(changeEvent: CalendarEventTimesChangedEvent): void {
    const { event, newStart, newEnd } = changeEvent;
    event.start = newStart; event.end = newEnd;
    this.events = [...this.events]; this.refresh.next();
  }

  onMonthEventDrop(dropData: any, newDate: Date): void {
    const event = dropData.event;
    const duration = event.end!.getTime() - event.start!.getTime();
    const newStart = new Date(newDate);
    newStart.setHours(event.start.getHours(), event.start.getMinutes());
    event.start = newStart; event.end = new Date(newStart.getTime() + duration);
    this.events = [...this.events]; this.refresh.next();
  }

  eliminarEvento(modal: any) { this.events = this.events.filter(e => e !== this.eventoEditando); this.refresh.next(); modal.close(); }
  prevDate() { this.viewDate = this.view === CalendarView.Month ? subMonths(this.viewDate, 1) : this.view === CalendarView.Week ? subWeeks(this.viewDate, 1) : subDays(this.viewDate, 1); }
  nextDate() { this.viewDate = this.view === CalendarView.Month ? addMonths(this.viewDate, 1) : this.view === CalendarView.Week ? addWeeks(this.viewDate, 1) : addDays(this.viewDate, 1); }
  setView(view: CalendarView) { this.view = view; localStorage.setItem('vistaCalendario', view); }
  
  private getColorMateria(materia: string): { bg: string; border: string; text: string } {
    let hash = 0; for (let i = 0; i < materia.length; i++) hash = materia.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash % 360);
    return { bg: `hsl(${h}, 70%, 90%)`, border: `hsl(${h}, 70%, 50%)`, text: `hsl(${h}, 70%, 20%)` };
  }

  descargar(formato: string) {
  if (formato === 'PDF') {
    window.print();
  } else if (formato === 'EXCEL') {
    let nombre = window.prompt("Ingrese el nombre:", "Horario_Semestral") || "Horario_Semestral";
    if (!nombre.endsWith(".xlsx")) nombre += ".xlsx";

    const datos = this.events.map(e => ({
      'DÍA': e.start.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase(),
      'MATERIA': e.title.toUpperCase(),
      'DOCENTE': (e.meta?.docente || 'N/A').toUpperCase(),
      'INICIO': e.start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      'FIN': e.end ? e.end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(datos); 

    ws['A1'] = { v: `PERIODO: ${this.periodoSeleccionado.toUpperCase()}`, t: 's' };
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    const encabezados = [['DÍA', 'MATERIA', 'DOCENTE', 'INICIO', 'FIN']];
    XLSX.utils.sheet_add_aoa(ws, encabezados, { origin: 'A2' });

    const estiloTitulo = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } };
    const estiloEncabezado = { 
        font: { bold: true, color: { rgb: "FFFFFF" } }, 
        fill: { fgColor: { rgb: "2C3E50" } }, 
        alignment: { horizontal: 'center' } 
    };

    ws['A1'].s = estiloTitulo;
    for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: 1, c: c });
        if (!ws[addr]) continue;
        ws[addr].s = estiloEncabezado;
    }

    ws['!cols'] = [{ wch: 15 }, { wch: 45 }, { wch: 45 }, { wch: 25 }, { wch: 25 }];

    const wb = { Sheets: { 'Horario': ws }, SheetNames: ['Horario'] };
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
  }
}
}