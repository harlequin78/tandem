import "./index.scss";
import React =  require("react");

const STEM_WIDTH = 4;

export default class LineComponent extends React.Component<any, any> {
  render() {

    const stemWidth = this.props.showStems !== false ? STEM_WIDTH / this.props.zoom : 0;
    const bounds = this.props.bounds;
    const fontSize = 10 / this.props.zoom;
    const letterSpacing = 1.2 / this.props.zoom;

    const sections: any = {};
    let d;
    const padding = 3  / this.props.zoom;

    if (bounds.direction === "ew") {

      const y = Math.round(bounds.height / 2);

      // center & offset width of text
      sections.text = (
        <text
          x={Math.round(bounds.width / 2) - (String(this.props.bounds.width).length * 5) / 2}
          y={y + 20 / this.props.zoom}
        >
          {Math.round(this.props.bounds.width)}
        </text>
      );

      d = [
        "M" + padding + " " + (y - stemWidth),
        "L" + padding + " " + (y + stemWidth),
        "M" + padding + " " + y,
        "L" + (bounds.width - padding) + " " + y,
        "M" + (bounds.width - padding) + " " + (y - stemWidth),
        "L" + (bounds.width - padding) + " " + (y + stemWidth),
      ];
    } else {
      const x = Math.round(bounds.width / 2);

      sections.text = (<text x={x + 10 / this.props.zoom}  y={Math.round(bounds.height / 2 + 4)}>
        {Math.round(this.props.bounds.height)}
      </text>);

      d = [
        "M" + (x - stemWidth) + " " + padding,
        "L" + (x + stemWidth) + " " + padding,
        "M" + x + " " + padding,
        "L" + x + " " + (bounds.height - padding),
        "M" + (x - stemWidth) + " " + (bounds.height - padding),
        "L" + (x + stemWidth) + " " + (bounds.height - padding),
      ];
    }

    const w = Math.max(bounds.width, 60) + stemWidth * 2;
    const h = Math.max(bounds.height, 60) + stemWidth * 2;

    return (
      <svg
        className="m-guide-line"
        fontSize={fontSize}
        style={{ position: "absolute", left: bounds.left, top: bounds.top }}
        width={w}
        height={h}
        viewBox={[0, 0, w, h].join(" ")}
      >
        <path d={d.join("")} strokeWidth={1 / this.props.zoom} fill="transparent" />
        {this.props.showDistance !== false ? sections.text : void 0}
      </svg>
    );
  }
}
