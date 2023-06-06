import React from 'react'
import styled from 'styled-components'
import { Link } from 'react-router-dom'
import { useNavMenuOpen, useToggleNavMenu } from '../../state/application/hooks'
import { ReactComponent as CloseIcon } from '../../assets/svg/ham_menu_close.svg'
// import { FUSE_CHAIN_ID } from '../../connectors'

const Wrapper = styled.div<{ isOpen: boolean }>`
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  background-color: #e7fafe;
  flex-direction: column;
  position: fixed;
  top: 0;
  bottom: 0;
  width: 100%;
  z-index: 150;
`

const Header = styled.div`
  display: flex;
  height: 50px;
  padding-right: 20px;
  margin-bottom: 30px;
  justify-content: end;
  align-items: center;
`

const Body = styled.div`
  margin-bottom: 40px;
`


const StyledCloseIcon = styled(CloseIcon)`
  cursor: pointer;
  margin-left: 21px;
`

const StyledLink = styled(Link)`
  display: inline-block;
  width: 100%;
  color: #b5b9d3;
  text-decoration: none;
  font-weight: 500;
`

const LinkContent = styled.div`
  display: flex;
  align-items: center;
  padding: 20px 40px;
  font-size: 25px;
  font-weight: bold;
  justify-content: center;
`

export default function MobileNav() {
  const navMenuOpen = useNavMenuOpen()
  const toggleNavMenu = useToggleNavMenu()

  return (
    <Wrapper isOpen={navMenuOpen}>
      <Header>
        <StyledCloseIcon onClick={() => toggleNavMenu()} />
      </Header>
      <Body>
        <StyledLink to="/home" onClick={() => toggleNavMenu()}>
          <LinkContent>
            Home
          </LinkContent>
        </StyledLink>
        <StyledLink to="/swap" onClick={() => toggleNavMenu()}>
          <LinkContent>
            Swap
          </LinkContent>
        </StyledLink>
        <StyledLink to="/pool" onClick={() => toggleNavMenu()}>
          <LinkContent>
            Pool
          </LinkContent>
        </StyledLink>
        <StyledLink to="/bridge" onClick={() => toggleNavMenu()}>
          <LinkContent>
            Bridge
          </LinkContent>
        </StyledLink>
        {/* <StyledLink to={`/farm/${FUSE_CHAIN_ID}`} onClick={() => toggleNavMenu()}>
          <LinkContent>
            Farm
          </LinkContent>
        </StyledLink> */}
        {/* <StyledLink to="/lending" onClick={() => toggleNavMenu()}>
          <LinkContent>
            Lending
          </LinkContent>
        </StyledLink> */}
        {/* <StyledLink to="/governance" onClick={() => toggleNavMenu()}>
          <LinkContent>
            Governance
          </LinkContent>
        </StyledLink> */}
      </Body>
    </Wrapper>
  )
}
