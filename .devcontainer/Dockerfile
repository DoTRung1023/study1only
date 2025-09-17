FROM node:18

# Install additional OS packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    git \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspaces/25S1_WDC_UG_Groups_111

# Expose port 8080
EXPOSE 8080

# Start the application
CMD ["npm", "start"]