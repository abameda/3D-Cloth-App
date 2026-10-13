"""Thread's local, real multi-view reconstruction. No paid reconstruction endpoints."""
from __future__ import annotations
import argparse, hashlib, json, os, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPELINE_VERSION='2026-10-11.1'
os.environ.setdefault('U2NET_HOME', str(ROOT / '.runtime' / 'reconstruction-models'))
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / '.runtime' / 'numba-cache'))

def emit(stage, **values):
    print(json.dumps({'stage': stage, **values}), flush=True)

def atomic_json(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value), encoding='utf-8')
    temp.replace(path)

def execute(job, stage, argv, expected, timeout=1800):
    checkpoint = job / f'{stage}.done.json'
    if checkpoint.exists():
        saved=json.loads(checkpoint.read_text())
        if saved.get('version')!=PIPELINE_VERSION:
            raise RuntimeError('The engine changed since this capture. Start a new capture to avoid mixing old and new processing results.')
        if all(p.exists() and p.stat().st_size for p in expected):
            emit(stage, resumed=True)
            return
    if (job / 'cancel').exists():
        raise RuntimeError('Processing was cancelled.')
    emit(stage)
    with (job / f'{stage}.log').open('wb') as log:
        result = subprocess.run([str(a) for a in argv], cwd=job, stdout=log, stderr=log, timeout=timeout, shell=False)
    if result.returncode or not all(p.exists() and p.stat().st_size for p in expected):
        raise RuntimeError(f'{stage} could not finish. Try more overlapping, sharp photos in steady lighting. Local diagnostic logs are available on the computer.')
    atomic_json(checkpoint, {'completed': time.time(),'version':PIPELINE_VERSION})

def prepare(job, source, kind, isolate):
    import cv2
    import numpy as np
    from PIL import Image, ImageOps
    photos = sorted(p for p in source.iterdir() if p.suffix.lower() in ['.jpg', '.jpeg', '.png'])
    if len(photos) < 8 or len(photos) > 48:
        raise ValueError('Use 8–48 overlapping photos; 24 or more is recommended for face and garment captures.')
    images, masks = job / 'images', job / 'masks'
    images.mkdir(exist_ok=True); masks.mkdir(exist_ok=True)
    checkpoint=job/'prepare.done.json'
    source_hash=hashlib.sha256(b''.join(hashlib.sha256(path.read_bytes()).digest() for path in photos)).hexdigest()
    if checkpoint.exists() and len(list(images.glob('*.jpg')))==len(photos):
        saved=json.loads(checkpoint.read_text())
        if saved.get('sourceHash')!=source_hash or saved.get('version')!=PIPELINE_VERSION:
            raise ValueError('The capture or processing version changed. Start a new capture rather than reuse stale geometry.')
        return saved
    emit('checking_photos')
    session=None
    if isolate:
        if not (ROOT / '.runtime/reconstruction-models/models/u2net/u2net.onnx').is_file():
            raise RuntimeError('Install the free local segmentation weights before processing photos. Run local-engine/setup.ps1.')
        from rembg import new_session
        session=new_session('u2net',providers=['CPUExecutionProvider'])
    report=[]
    for index, path in enumerate(photos):
        with Image.open(path) as decoded:
            if decoded.width*decoded.height > 24_000_000:
                raise ValueError('A photo is too large. Use images below 24 megapixels.')
            image=ImageOps.exif_transpose(decoded).convert('RGB')
            if min(image.size)<320:
                raise ValueError(f'Photo {index+1} is too small. Retake it closer and sharper.')
            image.thumbnail((1600,1600))
        grey=cv2.cvtColor(np.array(image),cv2.COLOR_RGB2GRAY)
        if kind=='face' and index==0:
            detector=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml')
            faces=detector.detectMultiScale(grey,scaleFactor=1.1,minNeighbors=5,minSize=(80,80))
            if len(faces)!=1:
                raise ValueError('The first view must show one clear front-facing face. Retake it in steady lighting without other people.')
        blur=float(cv2.Laplacian(grey,cv2.CV_64F).var())
        if blur<12 or float(grey.mean())<12 or float(grey.mean())>247:
            raise ValueError(f'Photo {index+1} is blurry or poorly exposed. Retake it before processing.')
        name=f'{index:04d}.jpg'
        if session:
            from rembg import remove
            cutout=remove(image,session=session)
            mask=(np.array(cutout.getchannel('A'))>128).astype(np.uint8)*255
            coverage=float((mask>0).mean())
            if coverage<.06 or coverage>.98:
                raise ValueError(f'Photo {index+1} could not be isolated reliably. Use a plain contrasting background.')
            Image.fromarray(mask).save(masks/(name+'.png'))
            pixels=np.array(image);pixels[mask==0]=0;Image.fromarray(pixels).save(images/name,quality=95)
        else:
            coverage=1.0;image.save(images/name,quality=95)
        report.append({'photo':index+1,'sharpness':round(blur,2),'foreground':round(coverage,3)})
    value={'count':len(photos),'kind':kind,'isolation':isolate,'photos':report,'sourceHash':source_hash,'version':PIPELINE_VERSION}
    atomic_json(checkpoint,value)
    return value

def align_and_pack(job, model, kind, capture):
    import numpy as np
    import trimesh
    scene=trimesh.load_scene(model,process=False)
    if not scene.geometry:
        raise ValueError('No reconstructed surface was produced.')
    vertices=np.vstack([m.vertices for m in scene.geometry.values()])
    if not np.isfinite(vertices).all():
        raise ValueError('The reconstructed geometry is invalid.')
    faces=sum(len(m.faces) for m in scene.geometry.values())
    if faces<300 or faces>80000:
        raise ValueError('The reconstructed surface is too incomplete or too large for mobile. Retake more overlapping views.')
    # First registered photograph defines upright/front, not a guessed head/body primitive.
    lines=(job/'sparse-txt'/'images.txt').read_text().splitlines()
    first=None
    for line in lines:
        if line.startswith('#'):continue
        parts=line.split()
        if len(parts)>=10 and parts[9]=='0000.jpg': first=parts;break
    if first is None:
        raise ValueError('The front photo did not align. Retake the front and adjacent angles.')
    qw,qx,qy,qz=map(float,first[1:5])
    rotation=trimesh.transformations.quaternion_matrix([qw,qx,qy,qz])
    rotation[:3,3]=[float(v) for v in first[5:8]]
    conversion=np.diag([1,-1,-1,1])@rotation
    scene.apply_transform(conversion)
    bounds=scene.bounds;center=(bounds[0]+bounds[1])/2;size=bounds[1]-bounds[0]
    if not np.isfinite(size).all() or min(size)<=0:
        raise ValueError('No usable reconstruction volume was measured.')
    # Uniform normalization changes placement/units, never facial proportions.
    placement=np.eye(4);placement[:3,3]=-center;scene.apply_transform(placement)
    if kind=='face': scene.apply_scale(.27/size[1])
    textures=0
    for mesh in scene.geometry.values():
        material=getattr(mesh.visual,'material',None)
        image=getattr(material,'baseColorTexture',None)
        if image is None: image=getattr(material,'image',None)
        if image is not None:
            textures+=1
            if max(image.size)>2048:
                image.thumbnail((2048,2048))
    if not textures: raise ValueError('No photographed texture was produced. Capture more well-lit views.')
    destination=job/'result.glb';destination.write_bytes(scene.export(file_type='glb'))
    if destination.stat().st_size>16*1024*1024:raise ValueError('The reconstructed asset exceeds the mobile memory budget.')
    report={'kind':kind,'photos':capture['count'],'triangles':faces,'textures':textures,'bytes':destination.stat().st_size,
        'geometry':'measured_multi_view','texture':'photographed_atlas','identity_verified':False,
        'fit_status':'not_fitted' if kind=='garment' else 'not_applicable','body_reconstructed':kind=='body',
        'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}
    atomic_json(job/'quality.json',report)
    emit('reconstructed',quality=report)

def run(job,source,kind,isolate=True):
    job=job.resolve();source=source.resolve();job.mkdir(parents=True,exist_ok=True)
    colmap=ROOT/'.runtime/colmap/bin/bin/colmap.exe'
    mvs=ROOT/'.runtime/openmvs/bin/vc17/x64/Release'
    for tool in [colmap,*[mvs/(n+'.exe') for n in ['InterfaceCOLMAP','DensifyPointCloud','ReconstructMesh','TextureMesh']]]:
        if not tool.is_file(): raise RuntimeError('The local reconstruction tools are not installed. Run the local setup on your computer first.')
    capture=prepare(job,source,kind,isolate)
    sparse=job/'sparse';sparse.mkdir(exist_ok=True)
    txt=job/'sparse-txt';txt.mkdir(exist_ok=True)
    feature=[colmap,'feature_extractor','--database_path',job/'database.db','--image_path',job/'images',
        '--ImageReader.single_camera','1','--FeatureExtraction.use_gpu','0','--FeatureExtraction.num_threads','6',
        '--FeatureExtraction.max_image_size','1600','--SiftExtraction.max_num_features','8192']
    if isolate:feature+=['--ImageReader.mask_path',job/'masks']
    execute(job,'aligning_features',feature,[job/'database.db'])
    execute(job,'matching_views',[colmap,'exhaustive_matcher','--database_path',job/'database.db','--FeatureMatching.use_gpu','0','--FeatureMatching.num_threads','6'],[job/'database.db'])
    execute(job,'measuring_geometry',[colmap,'mapper','--database_path',job/'database.db','--image_path',job/'images','--output_path',sparse,'--Mapper.num_threads','6'],[sparse/'0'/'images.bin'])
    execute(job,'checking_coverage',[colmap,'model_converter','--input_path',sparse/'0','--output_path',txt,'--output_type','TXT'],[txt/'images.txt'])
    registered=sum(1 for line in (txt/'images.txt').read_text().splitlines() if line and not line.startswith('#') and '.jpg' in line)
    if registered<max(8,int(capture['count']*.8)):
        raise ValueError('Too few photos overlap. Capture smaller angle changes while holding the subject still.')
    dense=job/'dense'
    execute(job,'preparing_depth',[colmap,'image_undistorter','--image_path',job/'images','--input_path',sparse/'0','--output_path',dense,'--output_type','COLMAP','--max_image_size','1200'],[dense/'sparse'/'images.bin'])
    execute(job,'building_scene',[mvs/'InterfaceCOLMAP.exe','-i',dense,'-o',job/'scene.mvs','--image-folder',dense/'images','-w',job],[job/'scene.mvs'])
    execute(job,'reconstructing_surface',[mvs/'DensifyPointCloud.exe','-i',job/'scene.mvs','-o',job/'scene_dense.mvs','-w',job,'--resolution-level','1','--max-resolution','1200','--min-resolution','320','--max-threads','6','--number-views','5'],[job/'scene_dense.ply',job/'scene_dense.mvs'])
    execute(job,'cleaning_mesh',[mvs/'ReconstructMesh.exe','-i',job/'scene_dense.mvs','-p',job/'scene_dense.ply','-o',job/'mesh.mvs','-w',job,'--max-threads','6','--decimate','.5'],[job/'mesh.ply'])
    import trimesh
    mesh=trimesh.load_mesh(job/'mesh.ply',process=False)
    if len(mesh.faces)>60000:
        mesh.simplify_quadric_decimation(face_count=60000).export(job/'mesh.ply')
    execute(job,'texturing',[mvs/'TextureMesh.exe','-i',job/'scene_dense.mvs','-m',job/'mesh.ply','-o',job/'textured.mvs','-w',job,'--max-threads','6','--max-texture-size','2048','--export-type','obj'],[job/'textured.obj'])
    emit('optimizing_mobile_asset')
    align_and_pack(job,job/'textured.obj',kind,capture)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--job',type=Path,required=True);parser.add_argument('--photos',type=Path,required=True);parser.add_argument('--kind',choices=['face','body','garment','benchmark'],required=True);parser.add_argument('--no-isolation',action='store_true')
    args=parser.parse_args()
    try: run(args.job,args.photos,args.kind,not args.no_isolation)
    except Exception as error:
        emit('failed',error=str(error));sys.exit(1)
