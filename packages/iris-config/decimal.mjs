// Decimal comparisons never round long seeds or schema bounds through Number.
export function decimal(value){
  const text=String(value),match=/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if(!match)throw new Error('Invalid decimal value.');
  let digits=(match[2]+(match[3]||'')).replace(/^0+/,''),exponent=BigInt(match[4]||'0')-BigInt((match[3]||'').length);
  if(!digits)return{sign:0,digits:'0',exponent:0n};
  const zeros=digits.length-digits.replace(/0+$/,'').length;digits=digits.slice(0,digits.length-zeros);exponent+=BigInt(zeros);
  return{sign:match[1]?-1:1,digits,exponent};
}
export function compareDecimal(a,b){
  a=decimal(a);b=decimal(b);if(a.sign!==b.sign)return a.sign<b.sign?-1:1;if(!a.sign)return 0;
  const ar=BigInt(a.digits.length)+a.exponent,br=BigInt(b.digits.length)+b.exponent;
  if(ar!==br)return(ar<br?-1:1)*a.sign;
  const length=Math.max(a.digits.length,b.digits.length),ad=a.digits.padEnd(length,'0'),bd=b.digits.padEnd(length,'0');
  return(ad===bd?0:ad<bd?-1:1)*a.sign;
}
export function isIntegerDecimal(value){const d=decimal(value);return d.sign===0||d.exponent>=0n;}
export function isMultipleDecimal(value,divisor){
  const a=decimal(value),b=decimal(divisor);if(b.sign<=0)throw new Error('Schema multipleOf must be positive.');if(a.sign===0)return true;
  const shift=a.exponent-b.exponent;
  // Keep arbitrary imported schemas from allocating a huge power of ten.
  if(shift>4096n||shift< -4096n||a.digits.length>16384||b.digits.length>16384)throw new Error('Decimal multipleOf exceeds the validator arithmetic budget.');
  const numerator=BigInt(a.digits)*(shift>0n?10n**shift:1n),denominator=BigInt(b.digits)*(shift<0n?10n**(-shift):1n);
  return numerator%denominator===0n;
}
