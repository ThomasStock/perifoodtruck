import * as THREE from "three";

export function nameTag(title: string, detail = "", own = false) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = "500 24px system-ui";
  const width = Math.min(
    540,
    Math.max(220, ctx.measureText(detail).width + 58),
  );
  ctx.font = "600 30px system-ui";
  canvas.width = Math.max(
    width,
    Math.min(540, ctx.measureText(title).width + 66),
  );
  canvas.height = detail ? 112 : 76;
  const bottom = canvas.height - 16;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.strokeStyle = own ? "#80c6b6" : "#d5dfda";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, canvas.width - 4, bottom, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = own ? "#009b80" : "#849c94";
  ctx.beginPath();
  ctx.arc(25, 34, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#21483f";
  ctx.font = "600 30px system-ui";
  ctx.textBaseline = "middle";
  ctx.fillText(title, 42, 34, canvas.width - 62);
  ctx.fillStyle = "#698177";
  ctx.font = "500 24px system-ui";
  if (detail) ctx.fillText(detail, 22, 72, canvas.width - 44);
  // A small pointer anchors the tag to its vehicle, without a floating bar.
  ctx.fillStyle = own ? "#80c6b6" : "#d5dfda";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 6, bottom + 4);
  ctx.lineTo(canvas.width / 2, bottom + 12);
  ctx.lineTo(canvas.width / 2 + 6, bottom + 4);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  sprite.scale.set(canvas.width / 110, canvas.height / 110, 1);
  return sprite;
}
