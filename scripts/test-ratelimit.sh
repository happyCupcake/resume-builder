# Add this content:
for i in {1..10}; do
    curl -I https://resumebuilder.store/ &
    sleep 0.1  # Only wait 0.1 seconds between requests
done
wait


# Running this script with rate limit config should show these logs in error.log
# tail -f /var/log/nginx/error.log
# 2025/01/12 08:43:03 [error] 228397#228397: *14407 limiting requests, excess: 3.401 by zone "one", client: 209.38.77.124, server: resumebuilder.store, request: "HEAD / HTTP/1.1", host: "resumebuilder.store"
# 2025/01/12 08:43:03 [error] 228397#228397: *14408 limiting requests, excess: 3.098 by zone "one", client: 209.38.77.124, server: resumebuilder.store, request: "HEAD / HTTP/1.1", host: "resumebuilder.store"
