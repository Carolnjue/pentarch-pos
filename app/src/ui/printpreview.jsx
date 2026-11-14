// Print preview dialog: shows the exact print document in an iframe, with Print + extra actions.
import { useEffect, useRef, useState } from 'preact/hooks';
import { openModal, Modal } from './overlay.jsx';
import { Btn } from './kit.jsx';
import { printHtml } from '../print/print.js';
import { t } from '../i18n/index.js';

const WIDTH = { 58: 230, 80: 310, a4: 800, label: 420 };
export function previewPrint(html, { title, paper = 80, actions, copies = 1, autoPrint } = {}) {
  return openModal((close) => <Preview html={html} title={title} paper={paper} actions={actions} copies={copies} close={close} autoPrint={autoPrint} />);
}
function Preview({ html, title, paper, actions, copies, close, autoPrint }) {
  const ref = useRef();
  const [h, setH] = useState(400);
  const w = WIDTH[paper] || 310;
  useEffect(() => { if (autoPrint) printHtml(html, { copies }); }, []);
  const onLoad = () => { try { const d = ref.current.contentDocument; setH(Math.min(4000, d.documentElement.scrollHeight + 10)); } catch {} };
  return (
    <Modal title={title || t('Print preview')} icon="print" size={paper === 'a4' ? 'xl' : 'lg'} onClose={() => close()}
      footer={<>{actions?.(close)}<span class="spacer" /><Btn onClick={() => close()}>{t('Close')}</Btn><Btn variant="primary" icon="print" onClick={() => printHtml(html, { copies })} data-autofocus>{t('Print')}</Btn></>}>
      <div class="paper-strip">
        <div style={{ width: w + 'px', margin: '0 auto', background: '#fff', boxShadow: 'var(--sh-2)', borderRadius: '4px', overflow: 'hidden' }}>
          <iframe ref={ref} title={t('Print preview')} srcDoc={html} onLoad={onLoad} style={{ width: '100%', height: h + 'px', border: 0, display: 'block' }} sandbox="allow-same-origin" />
        </div>
      </div>
    </Modal>
  );
}
