pipeline {
  agent any

  environment {
    IMAGE = 'smartlearn-lms'
    CONTAINER = 'smartlearn-lms'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build Image') {
      steps {
        sh 'docker build -t $IMAGE:$BUILD_NUMBER -t $IMAGE:latest .'
      }
    }

    stage('Test') {
      steps {
        sh '''
          docker run --rm $IMAGE:latest node --check server.js
          docker rm -f lms-test || true
          docker run -d --name lms-test $IMAGE:latest
          sleep 3
          docker exec lms-test wget -qO- http://localhost:3000/health
          docker rm -f lms-test
        '''
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          docker rm -f $CONTAINER || true
          docker run -d --name $CONTAINER --restart unless-stopped -p 3000:3000 $IMAGE:latest
          docker image prune -f
        '''
      }
    }

    stage('Verify') {
      steps {
        sh '''
          sleep 3
          curl -f http://localhost:3000/health
        '''
      }
    }
  }

  post {
    success { echo 'LMS deployed on port 3000' }
    failure { echo 'Pipeline failed. Check the console output.' }
  }
}pipeline {
  agent any

  environment {
    IMAGE = 'smartlearn-lms'
    CONTAINER = 'smartlearn-lms'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build Image') {
      steps {
        sh 'docker build -t $IMAGE:$BUILD_NUMBER -t $IMAGE:latest .'
      }
    }

    stage('Test') {
      steps {
        sh '''
          docker run --rm $IMAGE:latest node --check server.js
          docker rm -f lms-test || true
          docker run -d --name lms-test $IMAGE:latest
          sleep 3
          docker exec lms-test wget -qO- http://localhost:3000/health
          docker rm -f lms-test
        '''
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          docker rm -f $CONTAINER || true
          docker run -d --name $CONTAINER --restart unless-stopped -p 3000:3000 $IMAGE:latest
          docker image prune -f
        '''
      }
    }

    stage('Verify') {
      steps {
        sh '''
          sleep 3
          curl -f http://localhost:3000/health
        '''
      }
    }
  }

  post {
    success { echo 'LMS deployed on port 3000' }
    failure { echo 'Pipeline failed. Check the console output.' }
  }
}
