export const Logger = {
  recording: false,
  records: [] as any[],
  record() {
    this.recording = true;
    return this;
  },
  printRecords() {
    this.records.forEach((record) => console.log(...[record].flat()));
    return this;
  },
  endRecord() {
    this.recording = false;
    return this;
  },
  end(label: string) {
    console.timeEnd(label);
    return this;
  },
  log(...v: any[]) {
    console.log(...v);
    if (this.recording) {
      this.records.push(v);
    }
    return this;
  },
};
