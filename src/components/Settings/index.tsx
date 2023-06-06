import React, { useRef, useState } from 'react'
import styled from 'styled-components'
import { AiOutlineSetting, AiOutlineClose } from "react-icons/ai";
import { useUserSlippageTolerance, useExpertModeManager, useUserDeadline } from '../../state/user/hooks'
import TransactionSettings from '../TransactionSettings'
import { RowBetween } from '../Row'
import { TYPE } from '../../theme'
import QuestionHelper from '../QuestionHelper'
import Toggle from '../Toggle'
import { ButtonError } from '../Button'
import { useSettingsMenuOpen, useToggleSettingsMenu } from '../../state/application/hooks'
import { Text } from 'rebass'
import Modal from '../Modal'


const StyledMenuButton = styled.button`
  display: flex;
  /* flex-wrap: wrap; */
  justify-content: left;
  align-items: center;
  width:auto;
  height: auto;
  /* height: 30px; */
  border: none;
  background-color: transparent;
  margin-left: -5px;
  margin-top: 16px;
  /* border: 1px solid red; */
  /* padding: 0.15rem 32px; */
  .settingIcon{
    transition:all 0.3s;
    color: #796fa2 !important;
    font-size: 24px;
  }
  .settingIcon:hover{
      transform: scale(1.2,1.2);
    }
  >span{
    line-height: 42px;
    font-size: 16px;
    font-weight: 300;
    color: white;
    margin-left: 10px;
  }
  svg path{
    stroke: white;
    stroke-width: 1px;
    margin-top: 2px;
  }
  :hover,
  :focus {
    cursor: pointer;
    outline: none;    
  }
`
const EmojiWrapper = styled.div`
  position: absolute;
  bottom: -6px;
  right: 0px;
  font-size: 12px;
`

const StyledMenu = styled.div`
  height: 100%;
  width: 100%;
  height: 48px;
  bottom: 0;
  left: 0;
  border: none;
  text-align: left;
`

const MenuFlyout = styled.span`
  min-width: 260px;
  max-width: 260px;
  padding-left: 12px;
  padding-right: 12px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  background: #ede9f7;
  font-size: 12px;
  position: absolute;
  /* bottom: 48px; */
  /* top:70px; */
  right: 20px;
  z-index: 1000 !important;
  box-shadow: -2px -4px 10px 0px rgba(0, 0, 0, 0.75);
  -webkit-box-shadow: -2px -4px 10px 0px rgba(0, 0, 0, 0.75);
  -moz-box-shadow: -2px -4px 10px 0px rgba(0, 0, 0, 0.75);
  @media only screen and (max-width: 1300px) {
    padding: 1rem;
  }
`

const Break = styled.div`
  width: 100%;
  height: 1px;
  background-color: white;
`

const ModalContentWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background-color: #8089a1;
  border-radius: 20px;
`

const ModalContentInnerWrapper = styled.div`
  padding: 2rem;
`

export default function SettingsTab() {
  const node = useRef<HTMLDivElement>()
  const open = useSettingsMenuOpen()
  const toggle = useToggleSettingsMenu()

  const [userSlippageTolerance, setUserslippageTolerance] = useUserSlippageTolerance()

  const [deadline, setDeadline] = useUserDeadline()

  const [expertMode, toggleExpertMode] = useExpertModeManager()

  // show confirmation view before turning on
  const [showConfirmation, setShowConfirmation] = useState(false)

  return (
    // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/30451
    <StyledMenu ref={node as any}>
      <Modal isOpen={showConfirmation} onDismiss={() => setShowConfirmation(false)} maxHeight={100}>
        <ModalContentWrapper>
          <RowBetween padding="1rem 2rem">
            <div />
            <Text fontWeight={500} fontSize={20}>
              Are you sure?
            </Text>
            <div onClick={() => setShowConfirmation(false)}><AiOutlineClose className='CloseAI' /></div>
          </RowBetween>
          <Break />
          <ModalContentInnerWrapper>
            <Text fontWeight={500} fontSize={20} marginBottom={16}>
              Expert mode turns off the confirm transaction prompt and allows high slippage trades that often result in
              bad rates and lost funds.
            </Text>
            <Text fontWeight={600} fontSize={20} marginBottom={16}>
              ONLY USE THIS MODE IF YOU KNOW WHAT YOU ARE DOING.
            </Text>
            <ButtonError
              error={true}
              padding={'12px'}
              backgroundColor={'#3ad889 !important'}
              onClick={() => {
                if (window.prompt(`Please type the word "confirm" to enable expert mode.`) === 'confirm') {
                  toggleExpertMode()
                  setShowConfirmation(false)
                }
              }}
            >
              <Text fontSize={14} fontWeight={500} color={'white'} id="confirm-expert-mode">
                Turn On Expert Mode
              </Text>
            </ButtonError>
          </ModalContentInnerWrapper>
        </ModalContentWrapper>
      </Modal>
      {open && (
        <MenuFlyout>
          <TransactionSettings
            rawSlippage={userSlippageTolerance}
            setRawSlippage={setUserslippageTolerance}
            deadline={deadline}
            setDeadline={setDeadline}
          />

          <RowBetween>
            <TYPE.black fontWeight={600} fontSize={14} color={'#8089a1'} style={{ marginTop: 12, marginBottom: 12 }}>
              Toggle Expert Mode
            </TYPE.black>
            <QuestionHelper text="Bypasses confirmation modals and allows high slippage trades. Use at your own risk." />
          </RowBetween>
          <Toggle
            id="toggle-expert-mode-button"
            isActive={expertMode}
            toggle={
              expertMode
                ? () => {
                  toggleExpertMode()
                  setShowConfirmation(false)
                }
                : () => {
                  toggle()
                  setShowConfirmation(true)
                }
            }
          />
        </MenuFlyout>
      )}
      <StyledMenuButton onClick={toggle} id="open-settings-dialog-button">
        <AiOutlineSetting className='settingIcon' />
        {expertMode && (
          <EmojiWrapper>
            <span role="img" aria-label="wizard-icon">
              🧙
            </span>
          </EmojiWrapper>
        )}
      </StyledMenuButton>
    </StyledMenu>
  )
}
