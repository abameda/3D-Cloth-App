export type CaptureKind = 'face' | 'body' | 'garment';
export interface CaptureView { label: string; yaw: number }
export interface CaptureStep extends CaptureView { instruction: string }

/** Camera moves around a still subject; labels are guidance, not measured camera poses. */
export function captureGuide(kind: CaptureKind) {
 const setup = kind === 'face' ? [
  'Ask a helper to move the rear camera around your still head. Do not turn your head or move the phone at arm’s length.',
  'Keep a neutral expression, eyes open and lips relaxed. Remove glasses; keep hair away from your cheeks.',
  'Use soft, steady light and a plain contrasting background. Keep the whole head in frame, including chin and ears.',
 ] : kind === 'body' ? [
  'Ask a helper to walk around you while you stand still. Wear close-fitting, matte clothes; remove loose layers.',
  'Keep feet apart and arms slightly away from your torso. Include your whole body and feet in every view.',
  'Use steady light and a plain contrasting background. Keep the same pose for all photos.',
 ] : [
  'Keep the garment still on a mannequin or stable support with sleeves and leg openings separated. Do not rotate it between photos.',
  'Walk the camera around it. Keep the whole piece in frame; include the front, sides, back, hems, seams and closures.',
  'Use soft steady light and a contrasting background. Avoid flat-lay views mixed with worn views; smooth, shiny and black fabric can fail.',
 ];
 const degrees = kind === 'face'
  ? [0,15,30,45,60,75,90,-15,-30,-45,-60,-75,-90,0,15,30,45,60,75,90,-15,-30,-45,-60,-75,-90]
  : [0,15,30,45,60,75,90,105,120,135,150,165,180,-165,-150,-135,-120,-105,-90,-75,-60,-45,-30,-15];
 const steps: CaptureStep[] = degrees.map((degree,index)=>{
  const side=degree===0?'Front':Math.abs(degree)===180?'Back':degree>0?`Left ${degree}°`:`Right ${-degree}°`;
  const higher=kind==='face'&&index>=13;
  return {label:side+(higher?' · slightly above':''),yaw:degree*Math.PI/180,
   instruction:`${side}${higher?', with the camera slightly above eye level':''}. Move the camera to this view; keep the subject still. Keep at least two thirds of a neighboring captured view visible, then take the photo.`};
 });
 return {setup,steps};
}
