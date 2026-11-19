import { cityMeter, cityMeterColors } from "../ui/cityMeter";

export interface CityNameplateDetails {
  population: number;
  units: number;
  capacity: number;
  income: number;
}

export interface CityNameplateMotion {
  previous: CityNameplateDetails;
  target: CityNameplateDetails;
  pulse: number;
}

export const cityDetailHeight = 67;
export const boardNumberFontSize = 31;
const padding = 10;

export function measureCityDetails(ctx: CanvasRenderingContext2D, details: CityNameplateDetails, font: string) {
  const { population, units, capacity, income } = details;
  const incomeText = `+${income}`;
  const meter = cityMeter(population, units, capacity);
  const meterWidth = Math.min(204, Math.max(142, capacity * 17.5));
  const detailFont = `600 ${boardNumberFontSize}px ${font}`;
  ctx.font = detailFont;
  const width = Math.max(meterWidth, ctx.measureText(incomeText).width) + padding * 2;
  return { incomeText, meterWidth, detailFont, meter, width };
}

export function drawCityDetails(
  ctx: CanvasRenderingContext2D,
  row: ReturnType<typeof measureCityDetails>,
  titleHeight: number,
  width: number,
  motion?: CityNameplateMotion,
) {
  const centerY = titleHeight + 17;
  const incomeBounce = motion && motion.previous.income !== motion.target.income ? motion.pulse : 0;
  ctx.save();
  ctx.font = row.detailFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ecd9a2";
  ctx.translate(width / 2, titleHeight + 49 - incomeBounce * 4);
  ctx.scale(1 + incomeBounce * 0.09, 1 + incomeBounce * 0.13);
  ctx.fillText(row.incomeText, 0, 0);
  ctx.restore();

  const barLeft = (width - row.meterWidth) / 2;
  const height = 24;
  const top = centerY - height / 2;
  const { cells, deficit } = row.meter;
  const stride = row.meterWidth / cells.length;
  const gap = Math.min(8, stride * 0.24);
  const cellWidth = stride - gap;
  ctx.fillStyle = cityMeterColors.track;
  ctx.beginPath();
  ctx.roundRect(barLeft - 3, top - 3, row.meterWidth + 6, height + 6, 4);
  ctx.fill();
  for (const [index, { fill, unit }] of cells.entries()) {
    const x = barLeft + stride * index + gap / 2;
    ctx.fillStyle = cityMeterColors.empty;
    ctx.fillRect(x, top, cellWidth, height);
    if (fill) {
      const changing = motion && (motion.previous.population !== motion.target.population ||
        motion.previous.capacity !== motion.target.capacity) &&
        (motion.previous.capacity !== motion.target.capacity ||
          index >= Math.min(motion.previous.population, motion.target.population) &&
          index < Math.max(motion.previous.population, motion.target.population));
      const lift = changing ? motion.pulse * 3 : 0;
      ctx.fillStyle = cityMeterColors.population;
      ctx.fillRect(x, top - lift, cellWidth * fill, height + lift);
      if (motion && lift > 0) {
        const gain = motion.target.capacity > motion.previous.capacity || motion.target.population > motion.previous.population;
        ctx.save();
        ctx.globalAlpha = motion.pulse * 0.75;
        ctx.fillStyle = gain ? "#ffe7a3" : cityMeterColors.deficit;
        ctx.fillRect(x, top - lift, cellWidth * fill, height + lift);
        ctx.restore();
      }
    }
    if (unit) {
      const changing = motion && index >= Math.min(motion.previous.units, motion.target.units) &&
        index < Math.max(motion.previous.units, motion.target.units);
      const bounce = changing ? motion.pulse : 0;
      const radius = Math.min(9, cellWidth * 0.31) * Math.sqrt(unit) * (1 + bounce * 0.2);
      ctx.beginPath();
      ctx.arc(x + cellWidth / 2, centerY - bounce * 3, radius, 0, Math.PI * 2);
      ctx.strokeStyle = cityMeterColors.track;
      ctx.lineWidth = Math.min(3.6, radius * 0.65);
      ctx.fillStyle = cityMeterColors.units;
      ctx.stroke();
      ctx.fill();
    }
  }
  if (deficit) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, -deficit);
    ctx.fillStyle = cityMeterColors.deficit;
    ctx.fillRect(barLeft, top + height + 3, row.meterWidth, 2);
    ctx.restore();
  }
}
