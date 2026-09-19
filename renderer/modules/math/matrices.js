// Matrices de proyección/vista y utilidades de transformación de vectores.
(() => {
  'use strict';

  const { SDD3D } = window;

  function lookAt(eye, target, up) {
    const zAxis = SDD3D.vec3.normalize(SDD3D.vec3.subtract(eye, target));
    const xAxis = SDD3D.vec3.normalize(SDD3D.vec3.cross(up, zAxis));
    const yAxis = SDD3D.vec3.cross(zAxis, xAxis);
    return new Float32Array([
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      -SDD3D.vec3.dot(xAxis, eye), -SDD3D.vec3.dot(yAxis, eye), -SDD3D.vec3.dot(zAxis, eye), 1
    ]);
  }

  function perspective(fieldOfView, aspect, near, far) {
    const f = 1 / Math.tan(fieldOfView / 2);
    const rangeInverse = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInverse, -1,
      0, 0, near * far * rangeInverse * 2, 0
    ]);
  }

  function multiplyMatrices(a, b) {
    const output = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        output[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    return output;
  }

  function invertMatrix(matrix) {
    const a = matrix;
    const output = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4];
    const b01 = a[0] * a[6] - a[2] * a[4];
    const b02 = a[0] * a[7] - a[3] * a[4];
    const b03 = a[1] * a[6] - a[2] * a[5];
    const b04 = a[1] * a[7] - a[3] * a[5];
    const b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12];
    const b07 = a[8] * a[14] - a[10] * a[12];
    const b08 = a[8] * a[15] - a[11] * a[12];
    const b09 = a[9] * a[14] - a[10] * a[13];
    const b10 = a[9] * a[15] - a[11] * a[13];
    const b11 = a[10] * a[15] - a[11] * a[14];
    const determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!determinant) return null;
    const inverseDeterminant = 1 / determinant;
    output[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * inverseDeterminant;
    output[1] = (-a[1] * b11 + a[2] * b10 - a[3] * b09) * inverseDeterminant;
    output[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * inverseDeterminant;
    output[3] = (-a[9] * b05 + a[10] * b04 - a[11] * b03) * inverseDeterminant;
    output[4] = (-a[4] * b11 + a[6] * b08 - a[7] * b07) * inverseDeterminant;
    output[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * inverseDeterminant;
    output[6] = (-a[12] * b05 + a[14] * b02 - a[15] * b01) * inverseDeterminant;
    output[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * inverseDeterminant;
    output[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * inverseDeterminant;
    output[9] = (-a[0] * b10 + a[1] * b08 - a[3] * b06) * inverseDeterminant;
    output[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * inverseDeterminant;
    output[11] = (-a[8] * b04 + a[9] * b02 - a[11] * b00) * inverseDeterminant;
    output[12] = (-a[4] * b09 + a[5] * b07 - a[6] * b06) * inverseDeterminant;
    output[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * inverseDeterminant;
    output[14] = (-a[12] * b03 + a[13] * b01 - a[14] * b00) * inverseDeterminant;
    output[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * inverseDeterminant;
    return output;
  }

  function transformVector(matrix, vector) {
    return [
      matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2] + matrix[12] * vector[3],
      matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2] + matrix[13] * vector[3],
      matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2] + matrix[14] * vector[3],
      matrix[3] * vector[0] + matrix[7] * vector[1] + matrix[11] * vector[2] + matrix[15] * vector[3]
    ];
  }

  SDD3D.matrices = {
    lookAt,
    perspective,
    multiply: multiplyMatrices,
    invert: invertMatrix,
    transformVector
  };
})();
