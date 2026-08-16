"""无第三方依赖的生产冒烟：健康、登录、鉴权读取、关键状态列表。"""
import json, os, urllib.request
JAVA=os.getenv("JAVA_BASE_URL","http://localhost:8080")
def call(path,method="GET",body=None,token=None):
    data=json.dumps(body).encode() if body is not None else None;headers={"Content-Type":"application/json"}
    if token:headers["Authorization"]="Bearer "+token
    with urllib.request.urlopen(urllib.request.Request(JAVA+path,data=data,headers=headers,method=method),timeout=15) as r:return r.status,json.loads(r.read() or b"null")
assert call("/health")[0]==200
email=os.getenv("SMOKE_EMAIL","admin@shop.local");password=os.getenv("SMOKE_PASSWORD","admin123")
_,login=call("/api/auth/login","POST",{"email":email,"password":password});token=login["token"]
for path in ("/api/products","/api/orders","/api/purchase-orders","/api/operation-plans","/api/platform-tasks"):
    status,payload=call(path,token=token);assert status==200 and isinstance(payload,list),path
print("production smoke: OK")
