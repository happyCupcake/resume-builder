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
```
