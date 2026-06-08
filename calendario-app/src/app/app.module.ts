import { NgModule, LOCALE_ID } from '@angular/core'; 
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common'; 
import localeEs from '@angular/common/locales/es';     
import { FormsModule } from '@angular/forms';        

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CalendarioComponent } from './calendario/calendario.component';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { SchedulerModule } from 'angular-calendar-scheduler';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { DragAndDropModule } from 'angular-draggable-droppable'; 
import { HttpClientModule } from '@angular/common/http';


registerLocaleData(localeEs);

@NgModule({
  declarations: [
    AppComponent,
    CalendarioComponent,  
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    DragAndDropModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    NgbModule,
    FormsModule, 
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory,
    }),
    SchedulerModule.forRoot({ locale: 'es', headerDateFormat: 'daysRange' }),
  ],
  providers: [ 
    { provide: LOCALE_ID, useValue: 'es' } 
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }