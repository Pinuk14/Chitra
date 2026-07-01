export const exportBoardToImage = (
  strokes: any[],
  roomName: string,
  username: string,
  width: number = 1200,
  height: number = 700
) => {
  // Create an off-screen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return;

  // Draw background (solid white or off-white for export)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw subtle dot pattern (same as canvas)
  ctx.fillStyle = 'rgba(128, 128, 128, 0.2)';
  const spacing = 30;
  for (let x = spacing; x < width; x += spacing) {
    for (let y = spacing; y < height; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw all strokes
  strokes.forEach((shape) => {
    ctx.strokeStyle = shape.color || '#565656';
    ctx.lineWidth = shape.strokeWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = shape.fill || 'transparent';

    switch (shape.type) {
      case 'rectangle':
        if (shape.fill && shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
        if (shape.fill && shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
        break;
      case 'brush':
        if (!shape.points || shape.points.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
        break;
    }
  });

  // Apply Watermark
  ctx.fillStyle = 'rgba(108, 99, 255, 0.5)'; // neo-accent color with transparency
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  
  const padding = 20;
  const lineSpacing = 20;
  const timestamp = new Date().toLocaleString();
  
  const watermarkLines = [
    'Chitra Collaborative Whiteboard',
    `Room: ${roomName}`,
    `Exported by: ${username}`,
    `Time: ${timestamp}`
  ];

  watermarkLines.forEach((line, index) => {
    ctx.fillText(
      line, 
      width - padding, 
      height - padding - ((watermarkLines.length - 1 - index) * lineSpacing)
    );
  });

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `Chitra_Export_${roomName.replace(/\s+/g, '_')}_${new Date().getTime()}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
