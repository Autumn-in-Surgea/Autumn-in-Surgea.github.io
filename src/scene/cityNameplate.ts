import { cityMeter, cityMeterColors } from "../ui/cityMeter";

export interface CityNameplateDetails {
  population: number;
  units: number;
  capacity: number;
  income: number;
}

export const cityDetailHeight = 84;
const incomeFontSize = 37;
const padding = 10;

export function measureCityDetails(ctx: CanvasRenderingContext2D, details: CityNameplateDetails, font: string) {
  const { population, units, capacity, income } = details;
  const incomeText = `+${income}`;
  const meter = cityMeter(population, units, capacity);
  const meterWidth = Math.min(204, Math.max(142, capacity * 17.5));
  const detailFont = `600 ${incomeFontSize}px ${font}`;
  ctx.font = detailFont;
  const width = Math.max(meterWidth, ctx.measureText(incomeText).width) + padding * 2;
  return { incomeText, meterWidth, detailFont, meter, width };
}

export function drawCityDetails(
  ctx: CanvasRenderingContext2D,
  row: ReturnType<typeof measureCityDetails>,
  titleHeight: number,
  width: number,
) {
  const centerY = titleHeight + 19;
  ctx.font = row.detailFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ecd9a2";
  ctx.fillText(row.incomeText, width / 2, titleHeight + 60);

  const barLeft = (width - row.meterWidth) / 2;
  const height = 29;
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
      ctx.fillStyle = cityMeterColors.population;
      ctx.fillRect(x, top, cellWidth * fill, height);
    }
    if (unit) {
      const radius = Math.min(9, cellWidth * 0.31);
      ctx.beginPath();
      ctx.arc(x + cellWidth / 2, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = cityMeterColors.track;
      ctx.lineWidth = Math.min(3.6, radius * 0.65);
      ctx.fillStyle = cityMeterColors.units;
      ctx.stroke();
      ctx.fill();
    }
  }
  if (deficit) {
    ctx.fillStyle = cityMeterColors.deficit;
    ctx.fillRect(barLeft, top + height + 3, row.meterWidth, 2);
  }
}
