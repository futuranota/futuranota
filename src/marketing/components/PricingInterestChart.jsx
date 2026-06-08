import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';

const CHART_DATA = [
  { month: 'January', interest: 120 },
  { month: 'February', interest: 180 },
  { month: 'March', interest: 150 },
  { month: 'April', interest: 210 },
  { month: 'May', interest: 250 },
  { month: 'June', interest: 300 },
  { month: 'July', interest: 280 },
  { month: 'August', interest: 320 },
  { month: 'September', interest: 340 },
  { month: 'October', interest: 390 },
  { month: 'November', interest: 420 },
  { month: 'December', interest: 500 },
];

function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pricing-chart-tooltip">
      <span className="pricing-chart-tooltip__label">{label}</span>
      <span className="pricing-chart-tooltip__value">{payload[0].value} signups</span>
    </div>
  );
}

export function PricingInterestChart() {
  return (
    <div className="pricing-interest-chart card">
      <div className="pricing-interest-chart__head">
        <h4 className="pricing-interest-chart__title">Plan Popularity</h4>
        <p className="faint pricing-interest-chart__desc">
          Monthly trend of makers upgrading to Pro.
        </p>
      </div>
      <div className="pricing-interest-chart__body">
        <ResponsiveContainer width="100%" height={168}>
          <LineChart data={CHART_DATA} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line-soft)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: 'var(--faint)', fontSize: 10 }}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <Tooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="interest"
              type="monotone"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--bg)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
