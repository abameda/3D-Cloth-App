from pathlib import Path
import os
root=Path(__file__).resolve().parent.parent
os.environ['U2NET_HOME']=str(root/'.runtime/reconstruction-models')
os.environ['NUMBA_CACHE_DIR']=str(root/'.runtime/numba-cache')
from rembg import new_session
new_session('u2net',providers=['CPUExecutionProvider'])
print('Free local U2Net weights ready. No photo is uploaded by setup.')
