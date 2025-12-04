# AWS Elastic Beanstalk Deployment Checklist

## ✅ Configuration Files Present

- [x] `Dockerrun.aws.json` - Docker configuration for EB
- [x] `Dockerfile` - Docker image definition
- [x] `.ebextensions/` - EB configuration files
  - [x] `00_install_certbot.config` - SSL certificate setup
  - [x] `01_setup.config` - Database migrations
  - [x] `02_certbot_renewal.config` - SSL renewal cron job
  - [x] `10_open_https_port.config` - HTTPS port configuration
- [x] `package.json` - Node.js dependencies and scripts
- [x] `.gitignore` - Excludes node_modules, .env, etc.

## ✅ Configuration Status

### Port Configuration
- ✅ **FIXED**: Updated default port from 3000 to 8080 in `index.js` to match Dockerfile
- ✅ Dockerfile exposes port 8080
- ✅ Dockerrun.aws.json uses port 8080
- ✅ Application uses `process.env.PORT` (EB sets this automatically)

### Node.js Version Configuration
- ✅ **FIXED**: Updated Dockerrun.aws.json from Node 18 to Node 20 to match Dockerfile and package.json
- ✅ Dockerfile uses `node:20-alpine`
- ✅ package.json engines specifies `"node": "20.x"`
- ✅ All Node version references now consistent (Node 20)

### Database Configuration
- ✅ `knexfile.js` configured for production with RDS environment variables
- ✅ SSL enabled for production database connections
- ✅ Migrations configured to run on deployment (leader_only)

### Environment Variables Required
You'll need to set these in EB Environment Configuration:

**Database (RDS):**
- `RDS_HOSTNAME` or `DB_HOSTNAME`
- `RDS_USERNAME` or `DB_USERNAME`
- `RDS_PASSWORD` or `DB_PASSWORD`
- `RDS_DB_NAME` or `DB_NAME`
- `RDS_PORT` (defaults to 5432)

**Application:**
- `NODE_ENV=production` (already set in 01_setup.config)
- `SESSION_SECRET` (IMPORTANT: Set a strong secret in EB)
- `PORT` (automatically set by EB, but defaults to 8080)

### SSL/HTTPS Configuration
- ✅ Certbot installation configured
- ✅ SSL renewal cron job configured
- ✅ HTTPS port (443) opened in security group

## ⚠️ Pre-Deployment Actions Required

1. **Set Environment Variables in EB Console:**
   - Go to Configuration → Software → Environment properties
   - Add all required database and application variables
   - **CRITICAL**: Set a strong `SESSION_SECRET`

2. **Database Setup:**
   - Ensure RDS PostgreSQL instance is created and accessible
   - Verify database credentials
   - Test connection from EB environment

3. **File Uploads:**
   - `public/uploads/` directory exists
   - Consider using S3 for file storage in production (current setup uses local storage)

4. **Security:**
   - Review `.env` is in `.gitignore` ✅
   - Ensure no secrets are hardcoded
   - Verify SESSION_SECRET is set in EB environment variables

5. **Build & Deploy:**
   ```bash
   # Create deployment package (exclude node_modules, .env)
   zip -r deploy.zip . -x "node_modules/*" ".env" "*.zip" ".DS_Store"
   
   # Or use EB CLI:
   eb init
   eb create
   eb deploy
   ```

## 📋 Deployment Steps

1. **Create EB Application:**
   - Use Docker platform
   - Node.js 20.x (specified in package.json)

2. **Configure Environment:**
   - Set all environment variables
   - Configure RDS database connection
   - Set up load balancer (for HTTPS)

3. **Deploy:**
   - Upload `Dockerrun.aws.json` and source code
   - EB will:
     - Build Docker image
     - Run migrations (01_setup.config)
     - Start application on port 8080

4. **Post-Deployment:**
   - Verify application is running
   - Test database connectivity
   - Run SSL certificate setup (if using custom domain)
   - Test file uploads (if applicable)

## 🔍 Potential Issues to Watch

1. **File Uploads**: Currently using local storage - files will be lost on instance restart
   - Consider migrating to S3 for production

2. **Session Storage**: Using database sessions (good for multi-instance)
   - Ensure sessions table is created by migrations

3. **Static Files**: Served from `public/` directory
   - Ensure all images/assets are included in deployment

4. **Database Migrations**: Run automatically on deployment
   - Monitor logs to ensure migrations complete successfully

## ✅ Ready for Deployment

Your environment appears ready for AWS Elastic Beanstalk deployment! The main things to do:

1. Set environment variables in EB console
2. Ensure RDS database is configured
3. Deploy using EB CLI or console

