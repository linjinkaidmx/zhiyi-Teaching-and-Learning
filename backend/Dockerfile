FROM python:3.11-slim

WORKDIR /app

# 使用国内镜像源加速依赖安装
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --uid 10001 --create-home zhiyi && mkdir -p /app/data && chown -R zhiyi:zhiyi /app/data
USER zhiyi

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
