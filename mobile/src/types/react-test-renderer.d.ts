declare module 'react-test-renderer' {
  const renderer: {
    create: (element: unknown) => { toJSON: () => unknown };
  };
  export default renderer;
}
