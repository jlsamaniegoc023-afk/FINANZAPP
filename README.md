# FINANZAPP — Plataforma Inteligente de Administración Financiera Personal

**Proyecto académico – Módulo de Integración Continua para Proyectos de Software**

FINANZAPP centraliza el control de ingresos, gastos, presupuestos mensuales, cuentas financieras, obligaciones (deudas), metas de ahorro e indicadores visuales en una aplicación web adaptable a computador y celular.

---

## 1. Configuración Técnica Definitiva

| Componente | Tecnología | Función en el Proyecto |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | Interfaz de usuario reactiva |
| **Diseño** | Tailwind CSS | Sistema visual (`#14243A`, `#16A36A`, `#F3F6FA`, `#FFFFFF`) |
| **Gráficos** | Recharts | Estadísticas e indicadores financieros |
| **Backend** | Node.js + Express | API REST y lógica contable |
| **Autenticación** | Gmail OTP (6 dígitos) + JWT + bcrypt | Código aleatorio enviado al correo y sesión firmada |
| **Base de datos** | PostgreSQL 16 | Almacenamiento relacional local en contenedor |
| **Contenedores** | Docker + Docker Compose | Orquestación de `finanzapp-app` y `finanzapp-db` |
| **Red de contenedores** | `finanzapp_internal` (`internal: true`) | Comunicación privada aislada entre App y PostgreSQL 16 |
| **Persistencia** | Volumen Docker `finanzapp_data` | Almacenamiento duradero de datos PostgreSQL 16 |
| **Repositorio** | GitHub Free | Gestión de ramas y control de versiones |
| **Integración continua** | Jenkins local + Travis CI | Validación, pruebas, construcción y despliegue local |

---

## 2. Módulos Funcionales Implementados

1. **01. Dashboard financiero**: Patrimonio neto consolidado, saldo disponible, ingresos y gastos del período, gráfico comparativo semestral, progreso presupuestal, próximos vencimientos y últimos movimientos.
2. **02. Ingresos y gastos**: Registro, edición, eliminación, filtrado por categoría/cuenta/período, creación rápida de categorías y exportación CSV con actualización transaccional de saldos.
3. **03. Presupuestos**: Asignación de límites mensuales de gasto por categoría, umbrales preventivos de alerta (`%`) y seguimiento en tiempo real.
4. **04. Cuentas financieras**: Gestión de cuentas bancarias, ahorros, efectivo, billeteras e inversiones, incluyendo transferencias internas entre cuentas.
5. **05. Gestión de deudas**: Control de obligaciones, tasas E.A., cuotas pagadas, fechas de vencimiento y registro directo de abonos vinculados a cuentas y movimientos.
6. **06. Metas de ahorro**: Definición de objetivos financieros, cálculo de cuota mensual sugerida según fecha límite y registro de aportes.
7. **07. Reportes e indicadores**: Tasa real de ahorro, carga de endeudamiento, meses de liquidez disponible, consumo por categorías y curva de capacidad de ahorro.
8. **08. Usuarios y configuración**: Ingreso mediante **correo Gmail y código aleatorio de 6 dígitos** (`nodemailer` + hash `bcrypt` de un solo uso y vigencia de 10 minutos), emisión de token **JWT**, selector multimoneda (`COP`, `USD`, `MXN`, `EUR`) y restauración de datos de prueba.

---

## 3. Ingreso con Gmail (Código de 6 Dígitos) y Cuentas de Prueba

Al escribir un correo Gmail y hacer clic en **Ingresar**, el servidor genera un código criptográfico aleatorio de **6 dígitos** (`100000`–`999999`), almacena su hash `bcrypt` en la tabla `otp_verifications` de PostgreSQL 16 y lo despacha por **SMTP de Gmail** (`GMAIL_USER` y `GMAIL_APP_PASSWORD` configurados en `.env`). En entornos de laboratorio donde aún no se han definido las credenciales SMTP, muestra una vista previa local del código para facilitar las pruebas funcionales.

| Usuario | Correo Gmail de Prueba | Moneda |
| :--- | :--- | :--- |
| Carlos Andrés Mendoza | `carlos.mendoza.finanzapp@gmail.com` | `COP` |
| Ana Sofía Martínez | `ana.martinez.finanzapp@gmail.com` | `USD` |

---

## 4. Ejecución Local con Docker Compose y PostgreSQL 16

Los dos contenedores (`finanzapp-app` y `finanzapp-db`) se comunican exclusivamente a través de la red interna `finanzapp_internal`, mientras que los datos relacionales de **PostgreSQL 16** persisten en el volumen Docker nombrado **`finanzapp_data`**. Al iniciar por primera vez, el sistema ejecuta `database/init.sql` y carga automáticamente los usuarios y operaciones semilla en PostgreSQL.

```bash
# 1. Construir y levantar los dos contenedores comunicados
docker compose up --build -d

# 2. Verificar contenedores y el volumen persistente finanzapp_data
docker compose ps
docker volume inspect finanzapp_data

# 3. Verificar estado del servicio web en http://localhost:3000
curl http://localhost:3000/api/health
```

---

## 5. Integración Continua (GitHub Free, Jenkins Local y Travis CI)

- **Repositorio GitHub Free**: Flujo recomendado con ramas `main` (producción validada), `develop` (integración) y `feature/*` para cada módulo.
- **Jenkins Local (`Jenkinsfile`)**: Pipeline declarativo de 6 etapas que clona desde GitHub Free, instala paquetes (`npm ci`), valida tipos (`npm run lint`), ejecuta pruebas de integración (`npm test`), compila el frontend (`npm run build`) y despliega localmente con `docker compose up -d --build` verificando la respuesta de `/api/health`.
- **Travis CI (`.travis.yml`)**: Configurado para ejecutarse según disponibilidad de planes gratuitos/académicos de Travis CI, levantando una instancia efímera `postgres:16-alpine` para validar consultas SQL reales, pruebas de API y compilación de la imagen Docker.

---

## 6. Control de Versiones, Pruebas, Errores/Soluciones y Responsabilidades

### 6.1 Historial de Versiones
- **v0.1.0**: Estructura base Node.js + Express + React + Vite y autenticación JWT + bcrypt.
- **v0.2.0**: Implementación de los 8 módulos financieros con gráficos Recharts y validaciones contables.
- **v1.1.0**: Integración nativa con **PostgreSQL 16 local en Docker** (`pg.Pool` con transacciones ACID), red interna aislada `finanzapp_internal`, volumen persistente `finanzapp_data` y ajuste de tuberías CI para Jenkins local y Travis CI.

### 6.2 Bitácora de Errores Detectados y Soluciones Aplicadas
| ID | Incidencia Detectada | Causa Raíz | Solución Implementada |
| :--- | :--- | :--- | :--- |
| `INC-01` | Descuadre de saldo al editar el monto o cuenta de un movimiento existente. | La actualización modificaba el registro sin revertir el impacto contable previo. | Uso de transacciones SQL (`BEGIN` / `COMMIT` / `ROLLBACK`) que revierten el saldo anterior antes de aplicar el nuevo monto. |
| `INC-02` | Exposición innecesaria del puerto `5432` de PostgreSQL al equipo anfitrión. | Mapeo directo de puertos en el contenedor de base de datos. | Creación de la red puente aislada `finanzapp_internal` (`internal: true`) compartida solo entre `finanzapp-app` y `finanzapp-db`, y `finanzapp_gateway` únicamente en `finanzapp-app`. |
| `INC-03` | Arranque prematuro de Express antes de que PostgreSQL 16 termine de inicializar `finanzapp_data`. | Inicio simultáneo de servicios en Docker Compose. | Configuración de `healthcheck` con `pg_isready` y dependencia `condition: service_healthy`. |

### 6.3 Matriz de Responsabilidades del Equipo
| Rol | Responsabilidades Principales |
| :--- | :--- |
| **Arquitectura & Backend** | Diseño API REST en Express, repositorio transaccional `pg` sobre PostgreSQL 16 y seguridad JWT + bcrypt. |
| **Frontend & Experiencia Visual** | Interfaz adaptable en React + Tailwind CSS y tableros analíticos con Recharts. |
| **DevOps & Integración Continua** | Gestión en GitHub Free, orquestación Docker Compose (`finanzapp_data`), Jenkins local y Travis CI. |
