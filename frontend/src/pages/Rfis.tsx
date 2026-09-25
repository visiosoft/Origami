import { useSearchParams } from 'react-router-dom';
import { RfiLog } from '../components/rfis/Rfis';

/** Every project's RFIs. /rfis?rfi=<id> (from a reminder email) opens that one. */
export function RfisPage() {
  const [params] = useSearchParams();
  return (
    <div style={{ padding: '18px 22px', animation: 'fadeIn 0.3s ease' }}>
      <RfiLog openId={params.get('rfi')} />
    </div>
  );
}
