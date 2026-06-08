Cómo ejecutar el proyecto

1.Dentro de la carpeta calendario-app, verificar la instalación de dependencias

npm install


2.Configuración del entorno
Debido a la compatibilidad de versiones de OpenSSL, es necesario ejecutar este comando 

$env:NODE_OPTIONS="--openssl-legacy-provider"


3.Ejecutar el proyecto
ng serve


4.Visualización
Una vez que compile, accede desde tu navegador a:
http://localhost:4200/