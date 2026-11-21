
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
    APP_URL = 'http://localhost:3000'
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
        sh 'docker compose config -q'
      }
    }

    stage('8. Construir imágenes Docker') {
      steps {
        sh 'docker compose build finanzapp-app finanzapp-db'
      }
    }

    stage('9. Verificar imágenes Docker') {
      steps {
        sh '''
          echo "Verificando imagen de la aplicacion..."
          docker image inspect finanzapp-app:ci

          echo "Verificando imagen de PostgreSQL..."
          docker image inspect finanzapp-db:ci

          echo "Imagenes Docker construidas y verificadas correctamente."
        '''
      }
    }
  }

  post {
    always {
      sh 'docker rm -f finanzapp-pg-ci 2>/dev/null || true'
      echo 'Pipeline de integracion continua FINANZAPP finalizado.'
    }
  }
}

