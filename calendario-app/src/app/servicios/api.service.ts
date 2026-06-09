
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Esta es la URL base de tu compañero
  private baseUrl = 'https://api.pucesm.edu.ec/servicios/planta_docente/horarios';

  constructor(private http: HttpClient) { }

  // Función para cargar los datos del calendario
  cargarHorarios(params: any) {
    return this.http.post(`${this.baseUrl}/cargar_horario_calendario.php`, params);
  }

  // Función para guardar una clase
  guardarClase(data: any) {
    return this.http.post(`${this.baseUrl}/guardar_horario_clase.php`, data);
  }
}
