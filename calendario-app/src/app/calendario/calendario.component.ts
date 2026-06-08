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
  eventoForm = { docente: '', materia: '', inicio: '', fin: '', fecha: '' };

  tablaColores: any = {
    1: "#70B2E8", 
    2: "#9f9797", 
    3: "#dc5d4c", 
    4: "#b9d3bd", 
    5: "#e8c583", 
    6: "#b29574", 
    0: "#cba8cb"  
  };

  mensajeError: string = '';
  tipoDocente: 'Contratado' | 'Por Contratar' = 'Contratado';
  materiasDisponibles: string[] = [''];

  // --- INYECCIÓN DEL SERVICIO ---
  constructor(
    private modalService: NgbModal,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    const vistaGuardada = localStorage.getItem('vistaCalendario');
    if (vistaGuardada) {
      this.view = vistaGuardada as CalendarView;
    }

    // --- CARGA INICIAL DE DATOS ---
    this.cargarHorariosDesdeAPI();
  }

  cargarHorariosDesdeAPI() {
    const misParametros = {
      id_token: 'TU_TOKEN_AQUI',
      gen_periodos_period_id: '1',
      id_carrera_md5: 'TU_CARRERA_HASH'
    };

    this.apiService.cargarHorarios(misParametros).subscribe({
      next: (res: any) => {
        console.log("¡Respuesta del servidor!", res);
        // AJUSTA ESTOS CAMPOS SEGÚN LO QUE VEAS EN EL CONSOLE.LOG
        this.events = res.map((item: any) => ({
          title: item.materia, 
          start: new Date(item.fecha_inicio),
          end: new Date(item.fecha_fin),
          meta: { docente: item.docente }
        }));
        this.refresh.next();
      },
      error: (err) => console.error("Error al conectar:", err)
    });
  }

  ngAfterViewChecked() {
    const headers = document.querySelectorAll('.cal-header');
    headers.forEach((header: any) => {
      if (header.innerText.toLowerCase().trim() === 'schedule') {
        header.innerText = 'Hora';
      }
    });
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
      const dateObj = data.date || data || new Date();
      this.eventoForm = { docente: '', materia: '', inicio: '08:00', fin: '09:00', fecha: this.toLocalDateString(dateObj) };
    }
    this.modalService.open(template, { centered: true });
  }

  llenarFormulario(event: CalendarEvent) {
    this.eventoForm = {
      docente: event.meta?.docente || '',
      materia: event.meta?.materia || event.title || '',
      inicio: ('0' + event.start.getHours()).slice(-2) + ':' + ('0' + event.start.getMinutes()).slice(-2),
      fin: event.end ? ('0' + event.end.getHours()).slice(-2) + ':' + ('0' + event.end.getMinutes()).slice(-2) : '09:00',
      fecha: this.toLocalDateString(event.start)
    };
  }

  guardarEvento(modal: any) {
    const [hI, mI] = this.eventoForm.inicio.split(':').map(Number);
    const [hF, mF] = this.eventoForm.fin.split(':').map(Number);
    const [year, month, day] = this.eventoForm.fecha.split('-').map(Number);
    const nuevoInicio = new Date(year, month - 1, day, hI, mI);
    const nuevoFin = new Date(year, month - 1, day, hF, mF);
    const eventoEnConflicto = this.events.find(e => {
      if (e === this.eventoEditando) return false;
      return (nuevoInicio < e.end! && nuevoFin > e.start);
    });
    if (eventoEnConflicto) { this.mensajeError = `¡Error! Ya existe una clase programada en este horario.`; return; }
    this.mensajeError = '';
    
    const identificadorUnico = this.eventoForm.materia + this.eventoForm.docente;
    const c = this.getColorMateria(identificadorUnico);
    
    const nuevoEvento: CalendarEvent = {
      title: this.eventoForm.materia,
      start: nuevoInicio,
      end: nuevoFin,
      color: { primary: c.border, secondary: c.bg },
      draggable: true,
      meta: { docente: this.eventoForm.docente, materia: this.eventoForm.materia, tipo: this.tipoDocente }
    };
    if (this.eventoEditando) { this.events = this.events.map(e => e === this.eventoEditando ? nuevoEvento : e); } else { this.events = [...this.events, nuevoEvento]; }
    this.refresh.next();
    modal.close();
  }

  eventTimesChanged(changeEvent: CalendarEventTimesChangedEvent): void {
    const { event, newStart, newEnd } = changeEvent;
    event.start = newStart;
    event.end = newEnd;
    this.events = [...this.events];
    this.refresh.next();
  }

  onMonthEventDrop(dropData: any, newDate: Date): void {
    const event = dropData.event;
    const duration = event.end!.getTime() - event.start!.getTime();
    const newStart = new Date(newDate);
    newStart.setHours(event.start.getHours(), event.start.getMinutes());
    const newEnd = new Date(newStart.getTime() + duration);
    event.start = newStart;
    event.end = newEnd;
    this.events = [...this.events];
    this.refresh.next();
  }

  eliminarEvento(modal: any) {
    this.events = this.events.filter(e => e !== this.eventoEditando);
    this.refresh.next();
    modal.close();
  }

  prevDate() { this.viewDate = this.view === CalendarView.Month ? subMonths(this.viewDate, 1) : this.view === CalendarView.Week ? subWeeks(this.viewDate, 1) : subDays(this.viewDate, 1); }
  nextDate() { this.viewDate = this.view === CalendarView.Month ? addMonths(this.viewDate, 1) : this.view === CalendarView.Week ? addWeeks(this.viewDate, 1) : addDays(this.viewDate, 1); }
  
  setView(view: CalendarView) { 
    this.view = view; 
    localStorage.setItem('vistaCalendario', view);
  }
  
  private getColorMateria(materia: string): { bg: string; border: string; text: string } {
    let hash = 0;
    for (let i = 0; i < materia.length; i++) hash = materia.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash % 360);
    return { bg: `hsl(${h}, 70%, 90%)`, border: `hsl(${h}, 70%, 50%)`, text: `hsl(${h}, 70%, 20%)` };
  }
  
  private toLocalDateString(date: Date): string { return date.toISOString().substring(0, 10); }

  descargar(formato: string) {
    if (formato === 'PDF') {
      window.print();
    } else if (formato === 'EXCEL') {
      let nombreArchivo = window.prompt("Ingrese el nombre del archivo:", "Horario_Semestral");
      if (nombreArchivo === null) return;
      if (nombreArchivo.trim() === "") nombreArchivo = "Horario_Semestral";
      if (!nombreArchivo.toLowerCase().endsWith(".xlsx")) nombreArchivo += ".xlsx";

      const datosParaExcel = this.events.map(event => {
        const diaIndex = event.start.getDay();
        return {
          'DÍA': event.start.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase(),
          'MATERIA': event.title.toUpperCase(),
          'DOCENTE': (event.meta?.docente || 'N/A').toUpperCase(),
          'HORA INICIO': event.start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          'HORA FIN': event.end ? event.end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          '_diaIndex': diaIndex
        };
      });

      datosParaExcel.sort((a, b) => a._diaIndex - b._diaIndex);
      const reporteFinal = datosParaExcel.map(({ _diaIndex, ...resto }) => resto);
      const worksheet = XLSX.utils.json_to_sheet(reporteFinal);

      const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:F1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;
          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
          
          worksheet[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
          worksheet[cellAddress].s.border = {
            top: { style: 'thin', color: { rgb: "000000" } },
            bottom: { style: 'thin', color: { rgb: "000000" } },
            left: { style: 'thin', color: { rgb: "000000" } },
            right: { style: 'thin', color: { rgb: "000000" } }
          };
          
          if (R === 0) {
            worksheet[cellAddress].s.font = { bold: true, sz: 12, color: { rgb: "000000" } };
          } else {
            const diaIndex = datosParaExcel[R - 1]._diaIndex;
            worksheet[cellAddress].s.fill = { fgColor: { rgb: this.tablaColores[diaIndex].replace('#', '') } };
          }
        }
      }
      worksheet['!rows'] = Array(datosParaExcel.length + 1).fill({ hpt: 28 });
      worksheet['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 40 }, { wch: 20 }, { wch: 15 }];
      const workbook = { Sheets: { 'Horario': worksheet }, SheetNames: ['Horario'] };
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
      saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreArchivo);
    }
  }
}