
pipeline {
  agent any

  triggers {
    pollSCM('H/5 * * * *')
  }

  environment {
    NODE_ENV = 'test'
    JWT_SECRET = credentials('finanzapp-ci-jwt-secret')

    PGHOST = 'finanzapp-pg-ci'
    PGPORT = '5432'
    PGDATABASE = 'finanzapp'
    PGUSER = 'finanzapp_user'
    PGPASSWORD = credentials('finanzapp-ci-db-password')

    PORT = '3000'
    APP_URL = 'http://localhost:3001'

    APP_HOST_PORT = '3001'
    FINANZAPP_VOLUME_NAME = 'finanzapp_ci_data'
  }

  stages {
    stage('1. Descargar repositorio') {
      steps {
        checkout scm
      }
    }

    stage('2. Iniciar PostgreSQL 16 para pruebas') {
      steps {
        sh '''
          docker rm -f finanzapp-pg-ci 2>/dev/null || true

          docker run -d --name finanzapp-pg-ci \
            --network finanzapp_finanzapp_internal \
            --network-alias finanzapp-pg-ci \
            -e POSTGRES_DB=finanzapp \
            -e POSTGRES_USER=finanzapp_user \
            -e POSTGRES_PASSWORD="$PGPASSWORD" \
            postgres:16-alpine

          for i in $(seq 1 30); do
            if docker exec finanzapp-pg-ci pg_isready -U finanzapp_user -d finanzapp; then
              exit 0
            fi
            sleep 2
          done

          echo "PostgreSQL no inicio correctamente."
          exit 1
        '''
      }
    }

    stage('3. Instalar dependencias Bun') {
      steps {
        sh 'bun install --frozen-lockfile'
      }
    }

    stage('4. Validar TypeScript') {
      steps {
        sh 'bun run lint'
      }
    }

    stage('5. Ejecutar pruebas automatizadas') {
      steps {
        sh 'bun run test'
      }
    }

    stage('6. Construir frontend') {
      steps {
        sh 'bun run build'
      }
    }

    stage('7. Validar Docker Compose') {
      steps {
        sh 'docker compose -p finanzapp config -q'
      }
    }

    stage('8. Construir imagenes Docker') {
      steps {
        sh 'docker compose -p finanzapp build finanzapp-app finanzapp-db'
      }
    }

    stage('9. Verificar imagenes Docker') {
      steps {
        sh '''
          echo "Verificando imagen de la aplicacion..."
          docker image inspect finanzapp-app:ci

          echo "Verificando imagen de PostgreSQL..."
          docker image inspect finanzapp-db:ci

          echo "Imagenes Docker verificadas correctamente."
        '''
      }
    }

    stage('10. Iniciar entorno de integracion') {
      steps {
        sh '''
          docker compose -p finanzapp-ci up -d finanzapp-db finanzapp-app
          docker compose -p finanzapp-ci ps
        '''
      }
    }

    stage('11. Verificar disponibilidad de PostgreSQL CI') {
      steps {
        sh '''
          for i in $(seq 1 30); do
            if docker compose -p finanzapp-ci exec -T finanzapp-db \
              pg_isready -U "$PGUSER" -d "$PGDATABASE"; then
              echo "POSTGRESQL_CI_READY"
              exit 0
            fi
            sleep 2
          done

          echo "PostgreSQL CI no esta disponible."
          exit 1
        '''
      }
    }

    stage('12. Probar conexion y operaciones SQL') {
      steps {
        sh '''
          echo "Ejecutando prueba desde el contenedor de aplicacion..."

          docker compose -p finanzapp-ci exec -T finanzapp-app \
            bun /app/tests/db-connection.cjs
        '''
      }
    }

    stage('13. Verificar endpoint de salud') {
      steps {
        sh '''
          docker compose -p finanzapp-ci exec -T finanzapp-app bun -e '
            const response = await fetch("http://localhost:3000/api/health");
            const body = await response.text();

            console.log("HTTP_STATUS:", response.status);
            console.log("HEALTH_RESPONSE:", body);

            if (!response.ok) {
              process.exit(1);
            }
          '
        '''
      }
    }
  }

  post {
    always {
      sh '''
        echo "Limpiando entorno temporal de integracion..."

        docker compose -p finanzapp-ci down -v --remove-orphans 2>/dev/null || true

        docker rm -f finanzapp-pg-ci 2>/dev/null || true

        echo "Limpieza del entorno CI finalizada."
      '''

      echo 'Pipeline de integracion continua FINANZAPP finalizado.'
    }
  }
}
