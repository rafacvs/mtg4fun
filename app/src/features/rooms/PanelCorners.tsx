import panelCorner from '../../assets/theme/corner-v2.svg';

export function PanelCorners() {
  return <span className="preparation-panel-corners" aria-hidden="true">{[0, 1, 2, 3].map(corner => <img key={corner} src={panelCorner} alt="" />)}</span>;
}
