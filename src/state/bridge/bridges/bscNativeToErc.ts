import { TransactionResponse } from '@ethersproject/providers'
import * as Sentry from '@sentry/react'
import TokenBridge from './tokenBridge'
import { getERC677TokenContract, calculateGasMargin, pollEvent, getContract } from '../../../utils'
import {
  tokenTransferSuccess,
  tokenTransferPending,
  confirmTokenTransferPending,
  confirmTokenTransferSuccess,
  transferError
} from '../actions'
import {
  BSC_NATIVE_TO_ERC677_BRIDGE_HOME_ADDRESS,
  BSC_NATIVE_TO_ERC677_BRIDGE_FOREIGN_ADDRESS
} from '../../../constants'
import { getChainNetworkLibrary, getNetworkLibrary, BINANCE_CHAIN_ID } from '../../../connectors'
import { DEFAULT_CONFIRMATIONS_LIMIT } from '../../../constants/bridge'
import HomeBridgeABI from '../../../constants/abis/homeAMBNativeToErc20.json'
import ForeignBridgeABI from '../../../constants/abis/foreignAMBNativeToErc20.json'

export default class BscNativeToErcBridge extends TokenBridge {
  private readonly BRIDGE_EVENT = 'TokensBridged(address,uint256,bytes32)'

  private get homeBridgeAddress() {
    return BSC_NATIVE_TO_ERC677_BRIDGE_HOME_ADDRESS
  }

  private get foreignBridgeAddress() {
    return BSC_NATIVE_TO_ERC677_BRIDGE_FOREIGN_ADDRESS
  }

  private get homeBridgeContract() {
    return getContract(this.homeBridgeAddress, HomeBridgeABI, this.library, this.account)
  }

  private get homeNetworkLibrary() {
    return getNetworkLibrary()
  }

  private get foreignNetworkLibrary() {
    return getChainNetworkLibrary(BINANCE_CHAIN_ID)
  }

  async transferToForeign(): Promise<TransactionResponse | null> {
    this.dispatch(tokenTransferPending())

    const contract = this.homeBridgeContract
    const address = this.receiverAddress ? this.receiverAddress : this.account
    const args = [address]
    const value = this.amount.raw.toString()

    const estimatedGas = await contract.estimateGas.relayTokens(...args, { value })
    const response = await contract.relayTokens(...args, { gasLimit: calculateGasMargin(estimatedGas), value })

    this.dispatch(tokenTransferSuccess())

    return response
  }

  async transferToHome(): Promise<TransactionResponse> {
    if (this.chainId !== BINANCE_CHAIN_ID)
      throw new Error(`Chain not supported for bscNativeToErc bridge transaction, chainId: ${this.chainId}`)

    this.dispatch(tokenTransferPending())

    const contract = getERC677TokenContract(this.tokenAddress, this.library, this.account)
    const args = [this.foreignBridgeAddress, this.amount.raw.toString(), []]

    const estimatedGas = await contract.estimateGas.transferAndCall(...args, {})
    const response = await contract.transferAndCall(...args, { gasLimit: calculateGasMargin(estimatedGas) })

    this.dispatch(tokenTransferSuccess())

    return response
  }

  async watchForeignBridge() {
    this.dispatch(confirmTokenTransferPending())

    await pollEvent(
      this.BRIDGE_EVENT,
      this.foreignBridgeAddress,
      ForeignBridgeABI,
      this.foreignNetworkLibrary,
      async (eventArgs: any[]) => {
        const [recipient] = eventArgs
        const receiverAddress = this.receiverAddress ? this.receiverAddress : this.account
        return recipient === receiverAddress
      }
    )

    this.dispatch(confirmTokenTransferSuccess())
  }

  async watchHomeBridge() {
    this.dispatch(confirmTokenTransferPending())

    await pollEvent(
      this.BRIDGE_EVENT,
      this.homeBridgeAddress,
      HomeBridgeABI,
      this.homeNetworkLibrary,
      async (eventArgs: any[]) => {
        const [recipient] = eventArgs
        return recipient === this.account
      }
    )

    this.dispatch(confirmTokenTransferSuccess())
  }

  get transactionSummary(): string {
    return this.isHome
      ? 'Your tokens were transferred successfully to Binance please switch to Binance to use them'
      : 'Your tokens were transferred successfully to Fuse please switch to Fuse to use them'
  }

  async executeTransaction() {
    try {
      let response
      if (this.isHome) {
        response = await this.transferToForeign()
        await this.watchForeignBridge()
      } else {
        response = await this.transferToHome()
        await this.waitForTransaction(response.hash, DEFAULT_CONFIRMATIONS_LIMIT)
        await this.watchHomeBridge()
      }
      this.addTransaction(response, { summary: this.transactionSummary, text: this.transactionText })
      return response
    } catch (error) {
      this.dispatch(transferError())

      if (error?.code !== 4001) {
        Sentry.captureException(error, {
          tags: {
            section: 'Bridge',
            bridgeType: 'BscNativeToERC',
            isHome: this.isHome
          }
        })

        console.log(error)
      }

      return
    }
  }
}
