FROM nginx:1.25-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our production config
COPY nginx.conf /etc/nginx/nginx.conf

# Create SSL directory for certificate mounting
RUN mkdir -p /etc/nginx/ssl

# Create ACME challenge dir for Let's Encrypt cert renewal
RUN mkdir -p /var/www/certbot

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
