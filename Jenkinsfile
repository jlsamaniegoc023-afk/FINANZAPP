pipeline {
  agent any

  environment {
    NODE_ENV = 'test'
    JWT_SECRET = 'ci-only-secret-not-for-production'
    PGHOST = '127.0.0.1'
    PGPORT = '5432'
    PGDATABASE = 'finanzapp'
    PGUSER = 'finanzapp_user'
    PGPASSWORD = 'finanzapp_ci_password'
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
            -e POSTGRES_DB=finanzapp \
            -e POSTGRES_USER=finanzapp_user \
            -e POSTGRES_PASSWORD=finanzapp_ci_password \
            -p 5432:5432 postgres:16-alpine

          for i in $(seq 1 30); do
            if docker exec finanzapp-pg-ci pg_isready -U finanzapp_user -d finanzapp; then
              exit 0
            fi
            sleep 2
          done

          echo "PostgreSQL no inició correctamente."
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

    stage('8. Construir imagen Docker') {
      steps {
        sh 'docker build -t finanzapp-app:ci .'
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