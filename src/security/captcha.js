/**
 * Simple Math CAPTCHA
 * Self-contained CAPTCHA sin dependencias externas
 */

function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operation = Math.random() > 0.5 ? '+' : '-';

    let answer;
    if (operation === '+') {
        answer = num1 + num2;
    } else {
        if (num1 < num2) [num1, num2] = [num2, num1];
        answer = num1 - num2;
    }

    const token = Buffer.from(`${num1}${operation}${num2}:${answer}`).toString('base64');

    return {
        question: `${num1} ${operation === '+' ? 'm\u00E1s' : 'menos'} ${num2} = ?`,
        token,
        answer
    };
}

function verifyCaptcha(token, userAnswer) {
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const [equation, correctAnswer] = decoded.split(':');
        const userNum = parseInt(userAnswer, 10);

        if (isNaN(userNum)) return false;
        return userNum === parseInt(correctAnswer, 10);
    } catch (e) {
        return false;
    }
}

module.exports = { generateCaptcha, verifyCaptcha };
