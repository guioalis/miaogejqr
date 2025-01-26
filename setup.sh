mkdir meow-bot
cd meow-bot
npm init -y
npm install grammy node-fetch dotenv 

# 添加 docker 用户组（如果不存在）
sudo groupadd docker

# 将当前用户添加到 docker 用户组
sudo usermod -aG docker $USER

# 激活对组的更改
newgrp docker

# 验证是否可以不使用 sudo 运行 docker
docker ps 