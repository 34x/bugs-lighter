const deepOverride = (obj1, obj2) => {
  if (undefined === obj1 || null === obj1) {
    return obj2;
  }

  if (undefined === obj2 || null === obj2) {
    return obj1;
  }


  if ('object' !== typeof obj2) {
    return obj2;
  }

  const result = {};

  const keys = new Set(Object.keys(obj1 || {}).concat(Object.keys(obj2)));

  keys.forEach((key) => {
    let subResult = obj1[key];
    if (undefined !== obj2[key]) {
      subResult = deepOverride(subResult, obj2[key])
    }

    result[key] = subResult;
  });

  return result;
}

module.exports = {
  deepOverride,
  delay: (timeout) => {
    return new Promise((resolve) => {
      setTimeout(resolve, timeout);
    });
  }
}