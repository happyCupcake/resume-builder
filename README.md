## DropLet Instructions

1. #### Update system
```
sudo apt update
sudo apt upgrade
```

2. #### Install Node.js
```
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install nodejs
```

3. #### Install Nginx
```
sudo apt install nginx
```

4. #### Install PM2 for running Node.js
```
sudo npm install -g pm2
```

5. #### Get the code
```
ssh-keygen -t ed25519 -C "deploy-key-resume-builder"
cat ~/.ssh/id_ed25519.pub
Add as deploy key to private repo
git clone git@github.com:happyCupcake/resume-builder.git /var/www/resume-builder
```

6. #### Setup environment variables
```
cd /var/www/resume-builder
nano .env
```

7. #### Install dependencies
```
npm install
```

8. #### Setup nginx config
```
sudo nano /etc/nginx/sites-available/resume-builder

# Add this configuration
server {
    listen 80;
    server_name your_droplet_ip;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

9. #### Enable the site
```
sudo ln -s /etc/nginx/sites-available/resume-builder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

10. #### Start app with PM2
```
cd /var/www/resume-builder
pm2 start app.js --name "resume-builder"
pm2 startup
pm2 save
```

11. #### Enable SSL
```
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d resumebuilder.store -d www.resumebuilder.store
sudo nginx -t
sudo systemctl restart nginx
```

12. #### Enable PosgresSQL
```
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl status postgresql
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE resumebuilder;
CREATE USER resumeuser WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE resumebuilder TO resumeuser;

# Connect to the database

\c resumebuilder
-- Users table (extends Firebase auth data)
CREATE TABLE users (
    user_id VARCHAR(128) PRIMARY KEY,  -- Firebase UID
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analysis table
CREATE TABLE analyses (
    analysis_id SERIAL PRIMARY KEY,
    user_id VARCHAR(128) REFERENCES users(user_id),
    job_description TEXT NOT NULL,
    original_resume TEXT NOT NULL,
    optimized_resume TEXT,
    field VARCHAR(50),
    score INTEGER,
    matching_keywords TEXT[],
    status VARCHAR(20) DEFAULT 'preview',  -- 'preview' or 'paid'
    payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- List databases
\l

-- List tables (after connecting to resumebuilder)
\dt
```

13. #### Integrate with postgress NodeJs app
```
npm install pg
```

14. #### Debugging SQL
```
SELECT * FROM users;

SELECT 
    analysis_id,
    user_id,
    field,
    score,
    status,
    payment_id,
    created_at 
FROM analyses 
ORDER BY created_at DESC 
LIMIT 5;

ALTER USER resumeuser WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE resumebuilder TO resumeuser;
-- to list users
\du
```

15. #### Debugging nodejs
```
pm2 logs resume-builder --lines 1000
pm2 restart resume-builder
# when pulling new code make sure you npm install bring all dependencies
npm install
```

## Local testing on Ubuntu

1. ### Local server start
node app.js

2. ### Enable strip test mode locally
