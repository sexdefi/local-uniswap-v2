import {ethers} from "hardhat";
import {Token, UniswapV2Factory, UniswapV2Router02, WETH9} from "../typechain-types";

const wethAddress = '0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d';
const usdtAddress = '0xdbC43Ba45381e02825b14322cDdd15eC4B3164E6';
const toknAddress = '0x04C89607413713Ec9775E14b954286519d836FEf';
const factoryAddress = '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584';
const routerAddress = '0x21dF544947ba3E8b3c32561399E88B52Dc8b2823';


/*
* 代码流程：
* 1- 代币部署：[WETH9, USDT, TOKN]
* 2- 交易所部署：Uniswap x 2
* 3- 交易对部署：[WETH-TOKN, USDT-TOKN, WETH-USDT] x 2
* */
async function main() {
    const WETH9 = await ethers.getContractFactory("WETH9");
    const weth = await WETH9.attach(wethAddress);

    const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
    const router = await UniswapV2Router02.attach(routerAddress);

    const Token = await ethers.getContractFactory("Token");
    const usdt = await Token.attach(usdtAddress);
    const tokn = await Token.attach(toknAddress);

    const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
    const factory = await UniswapV2Factory.attach(factoryAddress);

    // await createPairs(weth, usdt, tokn, router, factory);

    // await addLiquidity(router, weth.address, usdt.address, 10000, 10000);
    
    for (let i = 0; i < 100; i++) {
        await buyToken(router,weth, tokn, 1).catch((e) => {
            // console.log(e);
            // buyToken(router,weth, tokn, 1);
        });
        await sellToken(router,weth, tokn, 1).catch((e) => {
            // console.log(e);
            // buyToken(router,weth, tokn, 1);
        });
    }
}

async function addLiquidity(router: UniswapV2Router02, tokenA: string, tokenB: string, numA: number, numB: number) {
    const deadline = Math.floor((new Date()).getTime() / 1000) + 20 * 60;
    const amountOf = (num: number) => (10n ** 18n * BigInt(num)).toString();
    const toAddress = (await ethers.getSigners())[0].address;
    return router.addLiquidity(tokenA, tokenB, amountOf(numA), amountOf(numB), amountOf(numA), amountOf(numB), toAddress, deadline);
}

async function createPairFactory(router: UniswapV2Router02, factory: UniswapV2Factory) {
    const deadline = Math.floor((new Date()).getTime() / 1000) + 20 * 60;
    const amountOf = (num: number) => (10n ** 18n * BigInt(num)).toString();
    const toAddress = (await ethers.getSigners())[0].address;
    return async (tokenA: string, tokenB: string, numA: number, numB: number) => {
        let tx = await router.addLiquidity(tokenA, tokenB, amountOf(numA), amountOf(numB), amountOf(numA), amountOf(numB), toAddress, deadline);
        let receipt = await tx.wait();
        let log = receipt.logs.filter((log) => log.address === factory.address)[0];
        return factory.interface.decodeFunctionResult("createPair", log.data).pair;
    }
}


async function createPairs(weth: WETH9, usdt: Token, tokn: Token, router: UniswapV2Router02, factory: UniswapV2Factory) {
    console.log(`${"-".repeat(11) + createPairs.name + `[${router.address}]` + "-".repeat(11)}`);
    // 1- Approve router
    const MAX = 2n ** 256n - 1n;
    await Promise.all([
        weth.approve(router.address, MAX),
        usdt.approve(router.address, MAX),
        tokn.approve(router.address, MAX)
    ]);
    // 2- Add Liquidity
    const createPair = await createPairFactory(router, factory);
    const [weth_tokn, usdt_tokn, weth_usdt] = await Promise.all([
        createPair(weth.address, tokn.address, 100, 1000),
        createPair(usdt.address, tokn.address, 100, 1000),
        createPair(weth.address, usdt.address, 1000, 1000)
    ]);
    console.log(`${"WETH-TOKN Liquidity : ".padStart(28)}${weth_tokn}`);
    console.log(`${"USDT-TOKN Liquidity : ".padStart(28)}${usdt_tokn}`);
    console.log(`${"WETH-USDT Liquidity : ".padStart(28)}${weth_usdt}`);

    return {weth_tokn, usdt_tokn, weth_usdt};
}

async function buyToken(router: UniswapV2Router02,weth: WETH9, tokn: Token, amount: number) {
    
    const deadline = Math.floor((new Date()).getTime() / 1000) + 20 * 60;
    const amountOf = (num: number) => (10n ** 18n * BigInt(num)).toString();
    const toAddress = (await ethers.getSigners())[0].address;

    console.log(`\n${"-".repeat(32) + buyToken.name + "-".repeat(32)}`);
    // 查询买之前的余额
    // let before = await tokn.balanceOf(toAddress);
    let price1 = await getTokenPrice(router,tokn,weth);

    await router.swapExactETHForTokens(0, [weth.address,tokn.address], toAddress, deadline, {
        value: amountOf(amount),
        gasLimit: 1000000,
    });

    let price2 = await getTokenPrice(router,tokn,weth);
    console.log('前：'+ price1+ " -- "+ '后：'+ price2);
    // return buy;
}

async function sellToken(router: UniswapV2Router02, weth: WETH9,tokn: Token, amount: number) {
    const deadline = Math.floor((new Date()).getTime() / 1000) + 20 * 60;
    const amountOf = (num: number) => (10n ** 18n * BigInt(num)).toString();
    const toAddress = (await ethers.getSigners())[0].address;

    console.log(`\n${"-".repeat(32) + sellToken.name + "-".repeat(32)}`);
    let before = await tokn.balanceOf(toAddress);
    let price1 = await getTokenPrice(router,tokn,weth);

    await router.swapExactTokensForETH(amountOf(amount), 0, [tokn.address,weth.address], toAddress, deadline);
    let price2 = await getTokenPrice(router,tokn,weth);
    console.log('前：'+ price1+ " -- "+ '后：'+ price2);
}

async function getTokenPrice(router: UniswapV2Router02, tokenA: Token, tokenB: WETH9) {
    const amountOf = (num: number) => (10n ** 18n * BigInt(num)).toString();
    const [amountA, amountB] = await router.getAmountsOut(amountOf(1), [tokenA.address, tokenB.address], {gasLimit: 1000000});
    const price = Number(amountB) / Number(amountA);
    // console.log(`${tokenA.symbol} price in ${tokenB.symbol} : ${price}`);
    return price;
}




main().then(() => console.log(" ")).catch(console.error);
