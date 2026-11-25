"""Enroll one Render instance as a read-only deployment of the private studio."""
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

token = os.environ["RAUMSCAN_WORKER_TOKEN"].encode()
private_key = Ed25519PrivateKey.from_private_bytes(hashlib.sha256(b"raumscan-readonly-git-v1:" + token).digest())
public_key = private_key.public_key().public_bytes(serialization.Encoding.OpenSSH, serialization.PublicFormat.OpenSSH).decode()
identity = {"digest": hashlib.sha256(token).hexdigest(), "deploy_key": public_key}
class Enrollment(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in {"/health", "/processor-id", "/"}:
            self.send_error(404)
            return
        body = identity if self.path == "/processor-id" else {"status": "Awaiting read-only repository enrollment"}
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(data)))
        self.end_headers()
        self.wfile.write(data)

with tempfile.TemporaryDirectory() as temp:
    base = Path(temp)
    secret = base/"id_ed25519"
    secret.touch(mode=0o600)
    secret.write_bytes(private_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH, serialization.NoEncryption()))
    known_hosts = base/"known_hosts"
    known_hosts.write_text("github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n")
    port = int(os.environ.get("PORT","10000"))
    server = ThreadingHTTPServer(("0.0.0.0",port), Enrollment)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    repo = Path.home()/"studio"
    env = {**os.environ,"GIT_SSH_COMMAND":f"ssh -T -p 443 -o HostKeyAlias=github.com -i {secret} -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes -o UserKnownHostsFile={known_hosts}"}
    while True:
        if (repo/".git").exists():
            args=["git","-C",str(repo),"pull","--ff-only"]
        else:
            args=["git","clone","--depth=1","--branch","main","ssh://git@ssh.github.com:443/destroyevskiy/raumscan-studio.git",str(repo)]
        result=subprocess.run(args,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if result.returncode==0:break
        print("Awaiting repository enrollment or connection.",flush=True)
        time.sleep(20)
    server.shutdown()
    server.server_close()
os.chdir(repo)
os.execv(sys.executable,[sys.executable,"-m","cloud.serve"])
