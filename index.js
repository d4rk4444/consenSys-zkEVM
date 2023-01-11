import w3 from 'web3';
import { parseFile, chainRpc, timeout } from '../Tools/other.js';
import { privateToAddress, toWei } from '../Tools/web3.js';
import { claimETHGoerli } from '../Tools/faucet.js';
import { getETHAmount } from '../Tools/DEX.js';
import { bridgeETHFromGoerliToConsensys } from '../Tools/bridge.js';
import chalk from 'chalk';
import consoleStamp from 'console-stamp';
import * as dotenv from 'dotenv';
dotenv.config();

consoleStamp(console, { format: ':date(HH:MM:ss)' });

(async() => {
    const wallet = parseFile('private.txt');
    const proxy = parseFile('proxy.txt');
    const acApi = process.env.AC_API;
    let status = false;

    console.log(chalk.cyan('Start claim'));
    for (let i = 0; i < wallet.length; i++) {
        if (!proxy[i]) {
            console.log('Для этого кошелька нет прокси');
            process.exit;
        }
        console.log(chalk.yellow(`[${i+1}] Wallet: ${privateToAddress(wallet[i])} / Proxy: ${proxy[i]}`));
        status = false;
        while (true) {
            await claimETHGoerli(acApi, privateToAddress(wallet[i]), proxy[i]).then(function(res) {
                if (res.status == 'false') {
                    if (res.msg == 'Please verify that you are not a robot.') {
                        console.log('Ошибка, повтор!');
                    } else if (res.msg == 'There are a lot of requests at the moment, so please try again later.') {
                        console.log('Сайт перенагружен, пробую еще раз');
                    }
                } else if (res.status == 'true') {
                    if (res.tx) {
                        status = true;
                        console.log(`КЛЕЙМ ${res.tx}`);
                    } else {
                        console.log(res);
                    }
                } else if (res.status == 'limit') {
                    status = true;
                    console.log(chalk.bgRed('Этот прокси или кошелек уже клеймили сегодня. Перехожу к следующему прокси'));
                }
            });
            await timeout(2000);
            if (status) break;
        }
        
    }
    console.log('-'.repeat(40));

    console.log(chalk.cyan('Start bridge ETH'));
    for (let i = 0; i < wallet[i].length; i++) {
        if (wallet[i].length != 66) {
            console.log(chalk.red(`Invalid mnemonic in ${i+1} string`));
        } else {
            console.log(chalk.yellow(`[${i+1}] Wallet: ${privateToAddress(wallet[i])} / Proxy: ${proxy[i]}`));
            status = false;
            while(true) {
                await getETHAmount(chainRpc.Goerli, privateToAddress(wallet[i])).then(async function(res) {
                    if (Number(res) >= toWei('0.024', 'ether')) {
                        await bridgeETHFromGoerliToConsensys(chainRpc.Goerli, wallet[i]);
                    } else {
                        console.log(chalk.yellow('Wait ETH on Goerli : Update every 2min'));
                        await timeout(120000);
                    }  
                });
                if (status) break;
            }
        }
    }
    console.log('Process End')
})();