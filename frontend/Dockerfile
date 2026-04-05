FROM nginx:alpine

# Copy the pre-built React app (built on laptop, committed to git)
COPY dist/ /usr/share/nginx/html/

# Copy our nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
